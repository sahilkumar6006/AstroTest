# Spec: Error Handling

## Overview
Defines the single, consistent error handling strategy for the entire AstroTalk backend.
All errors — validation, business logic, database, or unexpected — flow through one
global error middleware and produce a predictable response shape.

No module is allowed to send its own error response directly.
Every error must be thrown as an AppError and caught by the global handler.

---

## Core Rule

```
Any error anywhere in the app
  → throw AppError (or let it bubble as unknown Error)
  → caught by global error middleware in app.js
  → formatted into standard ErrorResponse
  → sent to client
```

Controllers never write `res.status(400).json(...)` for errors.
Services never write `res.json(...)` at all.
Only the global error middleware writes error responses.

---

## 1. AppError Class

### Location
```
src/utils/AppError.js
```

### Specification
```js
/**
 * Custom operational error class.
 * Throw this for all known, expected errors in the application.
 *
 * @param {string} message   - Human-readable message sent to the client
 * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 409, 422, 429, 500)
 * @param {string} code      - Machine-readable error code (UPPER_SNAKE_CASE)
 * @param {Array}  errors    - Optional field-level errors (422 only)
 */
class AppError extends Error {
  constructor(message, statusCode, code, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true; // distinguishes AppError from unexpected errors
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Usage Pattern
```js
// Simple error
throw new AppError('User not found', 404, 'USER_NOT_FOUND');

// With field-level errors (422 only)
throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', [
  { field: 'email', message: 'Invalid email format' },
  { field: 'phone', message: 'Phone number is required' }
]);
```

### Rules
- Always pass all three required arguments — never omit statusCode or code
- `code` must be UPPER_SNAKE_CASE and registered in the ErrorCode enum in openapi.yaml
- `errors` array is only populated for 422 responses
- `isOperational: true` marks it as a known error — the global handler treats unknown errors differently

---

## 2. Error Response Format

All error responses follow this exact shape — no exceptions:

```json
{
  "success": false,
  "message": "Human readable description of what went wrong",
  "code": "ERROR_CODE_SNAKE_UPPER",
  "errors": []
}
```

`errors` is always present as an array — empty `[]` for non-422 responses, populated for 422.

### Examples by status code

**401 Unauthorized**
```json
{
  "success": false,
  "message": "Authentication required. Please login.",
  "code": "UNAUTHORIZED",
  "errors": []
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Astrologer not found",
  "code": "ASTROLOGER_NOT_FOUND",
  "errors": []
}
```

**409 Conflict**
```json
{
  "success": false,
  "message": "A session is already active",
  "code": "SESSION_ALREADY_ACTIVE",
  "errors": []
}
```

**422 Validation Error**
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "phone", "message": "Invalid phone number format" },
    { "field": "otp",   "message": "OTP must be exactly 6 digits" }
  ]
}
```

**500 Internal Server Error** (never expose internals)
```json
{
  "success": false,
  "message": "Something went wrong. Please try again.",
  "code": "INTERNAL_ERROR",
  "errors": []
}
```

---

## 3. Zod Validation Error Format

Zod schema errors are caught and converted to the standard 422 format
by a `validateRequest` middleware — never handled individually in controllers.

### Location
```
src/middlewares/validateRequest.js
```

### Specification
```js
import { ZodError } from 'zod';
import AppError from '#utils/AppError.js';

/**
 * Middleware factory. Validates req.body, req.query, req.params against a Zod schema.
 * On failure, throws AppError with field-level errors array.
 *
 * @param {ZodSchema} schema - Zod object schema with body/query/params keys
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    const result = schema.parse({
      body:   req.body,
      query:  req.query,
      params: req.params,
    });
    // Attach parsed + coerced values back to req
    req.body   = result.body   ?? req.body;
    req.query  = result.query  ?? req.query;
    req.params = result.params ?? req.params;
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map(e => ({
        field:   e.path.slice(1).join('.'), // strip 'body'/'query' prefix
        message: e.message,
      }));
      return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', errors));
    }
    next(err);
  }
};

export default validateRequest;
```

### Usage in routes
```js
// auth.routes.js
import validateRequest from '#middlewares/validateRequest.js';
import { sendOtpSchema } from './auth.schema.js';

router.post('/send-otp', validateRequest(sendOtpSchema), authController.sendOtp);
```

### Zod schema shape convention
All Zod schemas must wrap fields under `body`, `query`, or `params` keys:

```js
// auth.schema.js
export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
    role:  z.enum(['user', 'astrologer']).optional().default('user'),
  }),
});

// Field path in error: 'phone' (not 'body.phone' — prefix stripped by middleware)
```

---

## 4. Global Error Middleware

### Location
```
src/middlewares/errorHandler.js
```

### Specification

The middleware handles four error categories in order:

| Category              | Identified by              | Response                          |
|-----------------------|----------------------------|-----------------------------------|
| AppError (operational)| `err.isOperational === true` | Use err.statusCode, err.code, err.message |
| Prisma known errors   | `err.code` starting with `P` | Mapped to AppError equivalents    |
| JWT errors            | `err.name` === JsonWebTokenError etc. | Mapped to 401                |
| Unknown errors        | Everything else            | 500, message hidden, logged fully |

```js
import { Prisma } from '@prisma/client';
import AppError from '#utils/AppError.js';
import logger from '#utils/logger.js';

const errorHandler = (err, req, res, next) => {

  // ── 1. AppError (operational, known) ────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code:    err.code,
      errors:  err.errors ?? [],
    });
  }

  // ── 2. Prisma errors ─────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, res);
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', { err });
    return res.status(400).json({
      success: false,
      message: 'Invalid data sent to the database',
      code:    'DATABASE_VALIDATION_ERROR',
      errors:  [],
    });
  }

  // ── 3. JWT errors ────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code:    'UNAUTHORIZED',
      errors:  [],
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      code:    'TOKEN_EXPIRED',
      errors:  [],
    });
  }

  // ── 4. Unknown / unexpected error ───────────────────
  // Log full error with stack trace — never expose to client
  logger.error('Unexpected error', {
    message: err.message,
    stack:   err.stack,
    url:     req.originalUrl,
    method:  req.method,
    userId:  req.user?.id ?? 'unauthenticated',
  });

  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    code:    'INTERNAL_ERROR',
    errors:  [],
  });
};

export default errorHandler;
```

### Prisma Error Mapping

```js
const handlePrismaError = (err, res) => {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation
      const field = err.meta?.target?.[0] ?? 'field';
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
        code:    'DUPLICATE_ENTRY',
        errors:  [],
      });
    }
    case 'P2025':
      // Record not found (e.g. on update/delete)
      return res.status(404).json({
        success: false,
        message: 'Record not found',
        code:    'NOT_FOUND',
        errors:  [],
      });
    case 'P2003':
      // Foreign key constraint failure
      return res.status(400).json({
        success: false,
        message: 'Related record does not exist',
        code:    'FOREIGN_KEY_ERROR',
        errors:  [],
      });
    default:
      logger.error('Unhandled Prisma error', { code: err.code, meta: err.meta });
      return res.status(500).json({
        success: false,
        message: 'A database error occurred',
        code:    'DATABASE_ERROR',
        errors:  [],
      });
  }
};
```

---

## 5. Async Error Wrapper

All async controller functions must be wrapped to avoid unhandled promise rejections.

### Location
```
src/utils/catchAsync.js
```

### Specification
```js
/**
 * Wraps an async Express route handler.
 * Any thrown error (AppError or unknown) is forwarded to next()
 * and caught by the global error middleware.
 *
 * @param {Function} fn - async (req, res, next) => {}
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
```

### Usage in controllers (mandatory)
```js
// auth.controller.js
import catchAsync from '#utils/catchAsync.js';

export const sendOtp = catchAsync(async (req, res) => {
  const { phone, role } = req.body;
  const data = await authService.sendOtp(phone, role);
  sendSuccess(res, data, 'OTP sent successfully');
});

// NEVER do this — unhandled rejection bypasses the error middleware:
// router.post('/send-otp', async (req, res) => { ... });
```

---

## 6. sendSuccess Utility

### Location
```
src/utils/sendSuccess.js
```

### Specification
```js
/**
 * Sends a standard success response.
 *
 * @param {Response} res
 * @param {*}        data        - Response payload (object, array, or null)
 * @param {string}   message     - Human-readable success message
 * @param {number}   statusCode  - HTTP status (default 200)
 * @param {object}   meta        - Optional pagination meta
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200, meta = null) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export default sendSuccess;
```

### Usage
```js
sendSuccess(res, user, 'Profile fetched');
sendSuccess(res, user, 'User created', 201);
sendSuccess(res, list, 'Astrologers fetched', 200, { page, limit, total, totalPages });
sendSuccess(res, null, 'Logged out successfully');
```

---

## 7. Registration in app.js

Order matters — error middleware must be registered last:

```js
// src/app.js
import express from 'express';
import errorHandler from '#middlewares/errorHandler.js';

const app = express();

app.use(express.json());

// All routes
app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/users',       userRoutes);
app.use('/api/v1/astrologers', astrologerRoutes);
app.use('/api/v1/sessions',    sessionRoutes);
app.use('/api/v1/payments',    paymentRoutes);
app.use('/api/v1/reviews',     reviewRoutes);

// 404 handler — must be after all routes, before errorHandler
app.use((req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.path}`, 404, 'NOT_FOUND'));
});

// Global error handler — must be last middleware, always 4 arguments
app.use(errorHandler);

export default app;
```

---

## 8. Error Codes Master List

Every code used anywhere in the app must be listed here and in openapi.yaml ErrorCode enum.

```
── Auth ──────────────────────────────
UNAUTHORIZED              401  Missing or invalid access token
TOKEN_EXPIRED             401  Access token expired
REFRESH_TOKEN_MISSING     401  Refresh token cookie not present
REFRESH_TOKEN_INVALID     401  Refresh token not found in DB
REFRESH_TOKEN_EXPIRED     401  Refresh token past expiry date
OTP_EXPIRED               401  OTP not found in Redis (expired)
OTP_INVALID               401  OTP hash does not match
OTP_RATE_LIMIT            429  Too many OTP requests
SMS_SEND_FAILED           500  SMS provider failure
ACCOUNT_BANNED            403  User account is banned

── Users ─────────────────────────────
EMAIL_TAKEN               409  Email already used by another account
FILE_TOO_LARGE            422  Uploaded file exceeds size limit
INVALID_FILE_TYPE         422  Uploaded file type not allowed

── Astrologers ───────────────────────
ASTROLOGER_NOT_FOUND      404  No astrologer with given ID

── Sessions ──────────────────────────
SESSION_NOT_FOUND         404  No session with given ID
SESSION_ALREADY_ACTIVE    409  User or astrologer already in a session
SESSION_NOT_COMPLETED     422  Session must be COMPLETED for this action
ASTROLOGER_NOT_AVAILABLE  409  Astrologer is offline or busy
INSUFFICIENT_WALLET       402  Wallet balance too low to start session

── Payments ──────────────────────────
ORDER_NOT_FOUND           404  Razorpay order not found
PAYMENT_SIGNATURE_INVALID 400  Razorpay HMAC signature mismatch

── Reviews ───────────────────────────
REVIEW_ALREADY_EXISTS     409  Review already submitted for this session

── Database ──────────────────────────
DUPLICATE_ENTRY           409  Unique constraint violation (Prisma P2002)
FOREIGN_KEY_ERROR         400  Foreign key constraint failure (Prisma P2003)
DATABASE_VALIDATION_ERROR 400  Prisma schema validation failure
DATABASE_ERROR            500  Unhandled Prisma error

── Generic ───────────────────────────
VALIDATION_ERROR          422  Zod field-level validation failure
NOT_FOUND                 404  Generic not found (route or resource)
FORBIDDEN                 403  Authenticated but not authorized
INTERNAL_ERROR            500  Unexpected server error
```

---

## 9. File Structure

```
src/
├── utils/
│   ├── AppError.js          ← custom error class
│   ├── catchAsync.js        ← async wrapper for controllers
│   └── sendSuccess.js       ← standard success response helper
└── middlewares/
    ├── errorHandler.js      ← global error middleware (registered last in app.js)
    └── validateRequest.js   ← Zod validation middleware
```

---

## 10. Test Cases

| #  | Scenario                                      | Expected                                      |
|----|-----------------------------------------------|-----------------------------------------------|
| 1  | Route throws AppError 404                     | 404 response with correct code and message    |
| 2  | Route throws AppError 422 with errors array   | 422 response with populated errors array      |
| 3  | Zod validation fails on req.body              | 422, VALIDATION_ERROR, field-level errors     |
| 4  | Zod validation fails on req.query             | 422, VALIDATION_ERROR, correct field paths    |
| 5  | Prisma P2002 (unique constraint)              | 409, DUPLICATE_ENTRY                          |
| 6  | Prisma P2025 (not found)                      | 404, NOT_FOUND                                |
| 7  | JWT is malformed                              | 401, UNAUTHORIZED                             |
| 8  | JWT is expired                                | 401, TOKEN_EXPIRED                            |
| 9  | Async controller throws unknown Error         | 500, INTERNAL_ERROR, stack logged not exposed |
| 10 | Unknown route accessed                        | 404, NOT_FOUND                                |
| 11 | Error response always has errors array        | errors: [] on non-422, populated on 422       |
| 12 | Success response always has success: true     | sendSuccess produces correct shape            |
