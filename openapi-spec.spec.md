# Spec: OpenAPI Specification Strategy

## Overview
`openapi.yaml` is the machine-readable contract for the entire AstroTalk API.
It is generated from and must always stay in sync with the feature spec files in `specs/`.
It is the single source of truth for: Swagger UI docs, Postman collections, contract tests, and client SDK generation.

---

## Core Rule

```
specs/*.spec.md  →  openapi.yaml  →  code
```

**The flow is always one direction.**
- A feature spec changes → openapi.yaml is updated → code is updated
- Code NEVER changes first
- openapi.yaml NEVER changes without a corresponding spec change

---

## File Location

```
astrotalk-backend/
├── openapi.yaml          ← root level, committed to git
├── specs/                ← source of truth (human-readable)
└── src/                  ← implementation
```

---

## When to Update openapi.yaml

| Trigger                              | Action                                      |
|--------------------------------------|---------------------------------------------|
| New endpoint added to a spec         | Add path + operation to openapi.yaml        |
| Request body shape changed in spec   | Update corresponding requestBody schema     |
| Response shape changed in spec       | Update corresponding response schema        |
| New error code added to spec         | Add to error responses + ErrorCode enum     |
| New DB field exposed in API          | Add to relevant schema component            |
| Endpoint removed from spec           | Remove from openapi.yaml + mark deprecated  |

---

## Sync Checklist (run before every PR)

```
For every endpoint changed in a spec:

[ ] Path exists in openapi.yaml
[ ] HTTP method matches spec
[ ] All request body fields documented with correct types
[ ] Required fields marked as required
[ ] All success responses documented with correct shape
[ ] All error responses listed (401, 403, 404, 409, 422, 429, 500)
[ ] Security scheme applied (bearerAuth or none)
[ ] Tags match the module name
[ ] operationId is unique and follows naming convention
[ ] New schema components added to components/schemas
[ ] New error codes added to ErrorCode enum
```

---

## Naming Conventions

### operationId
Format: `{verb}{Resource}{Qualifier?}`

```yaml
operationId: sendOtp
operationId: verifyOtp
operationId: refreshToken
operationId: getMyProfile
operationId: updateMyProfile
operationId: listAstrologers
operationId: getAstrologer
operationId: requestSession
operationId: endSession
operationId: createPaymentOrder
operationId: verifyPayment
operationId: createReview
operationId: listAstrologerReviews
```

### Tags (one per module)
```yaml
tags:
  - auth
  - users
  - astrologers
  - sessions
  - payments
  - reviews
  - horoscope
  - notifications
  - admin
```

### Schema component names
Format: PascalCase, descriptive
```yaml
components:
  schemas:
    # Requests
    SendOtpRequest
    VerifyOtpRequest
    UpdateProfileRequest
    RequestSessionRequest
    CreateReviewRequest

    # Responses
    AuthTokenResponse
    UserProfileResponse
    AstrologerListItemResponse
    AstrologerProfileResponse
    SessionResponse
    WalletResponse
    ReviewResponse

    # Shared
    PaginationMeta
    ErrorResponse
    SuccessResponse
```

---

## Base Structure

```yaml
openapi: 3.1.0

info:
  title: AstroTalk API
  version: 1.0.0
  description: |
    Backend API for AstroTalk — an astrologer consultation platform.
    All monetary values are in paise (₹1 = 100 paise).
    All timestamps are UTC ISO 8601.

servers:
  - url: http://localhost:3000/api/v1
    description: Local development
  - url: https://api.astrotalk.com/api/v1
    description: Production

tags:
  - name: auth
    description: OTP login, token refresh, logout
  - name: users
    description: User profile and wallet
  - name: astrologers
    description: Astrologer profiles and availability
  - name: sessions
    description: Chat, call, and video sessions
  - name: payments
    description: Wallet top-up via Razorpay
  - name: reviews
    description: Ratings and reviews for astrologers

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    # ── Shared ─────────────────────────────────────────

    SuccessResponse:
      type: object
      required: [success, message, data]
      properties:
        success:
          type: boolean
          example: true
        message:
          type: string
          example: "Operation successful"
        data:
          type: object
          nullable: true

    ErrorResponse:
      type: object
      required: [success, message, code]
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
        code:
          $ref: '#/components/schemas/ErrorCode'
        errors:
          type: array
          description: Field-level errors, present only on 422
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

    PaginationMeta:
      type: object
      properties:
        page:
          type: integer
          example: 1
        limit:
          type: integer
          example: 20
        total:
          type: integer
          example: 100
        totalPages:
          type: integer
          example: 5

    ErrorCode:
      type: string
      enum:
        # Auth
        - OTP_RATE_LIMIT
        - OTP_EXPIRED
        - OTP_INVALID
        - SMS_SEND_FAILED
        - REFRESH_TOKEN_MISSING
        - REFRESH_TOKEN_INVALID
        - REFRESH_TOKEN_EXPIRED
        - ACCOUNT_BANNED
        # Users
        - EMAIL_TAKEN
        - FILE_TOO_LARGE
        - INVALID_FILE_TYPE
        # Astrologers
        - ASTROLOGER_NOT_FOUND
        # Sessions
        - INSUFFICIENT_WALLET
        - ASTROLOGER_NOT_AVAILABLE
        - SESSION_ALREADY_ACTIVE
        - SESSION_NOT_FOUND
        - SESSION_NOT_COMPLETED
        # Reviews
        - REVIEW_ALREADY_EXISTS
        # Payments
        - PAYMENT_SIGNATURE_INVALID
        - ORDER_NOT_FOUND
        # Generic
        - VALIDATION_ERROR
        - UNAUTHORIZED
        - FORBIDDEN
        - NOT_FOUND
        - INTERNAL_ERROR

  responses:
    Unauthorized:
      description: Missing or invalid access token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            message: "Authentication required"
            code: UNAUTHORIZED

    Forbidden:
      description: Authenticated but not authorized for this action
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

    ValidationError:
      description: Field-level validation failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            success: false
            message: "Validation failed"
            code: VALIDATION_ERROR
            errors:
              - field: "phone"
                message: "Invalid phone number format"

    TooManyRequests:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

paths:
  # ── AUTH ───────────────────────────────────────────────

  /auth/send-otp:
    post:
      tags: [auth]
      operationId: sendOtp
      summary: Send OTP to phone number
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone:
                  type: string
                  pattern: '^\+[1-9]\d{7,14}$'
                  example: "+919876543210"
                role:
                  type: string
                  enum: [user, astrologer]
                  default: user
      responses:
        '200':
          description: OTP sent successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          phone:
                            type: string
                          expiresIn:
                            type: integer
                            example: 300
        '422':
          $ref: '#/components/responses/ValidationError'
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /auth/verify-otp:
    post:
      tags: [auth]
      operationId: verifyOtp
      summary: Verify OTP and login or register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone, otp]
              properties:
                phone:
                  type: string
                  pattern: '^\+[1-9]\d{7,14}$'
                otp:
                  type: string
                  pattern: '^\d{6}$'
                role:
                  type: string
                  enum: [user, astrologer]
                  default: user
      responses:
        '200':
          description: Login successful. Refresh token set as httpOnly cookie.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          accessToken:
                            type: string
                          user:
                            type: object
                            properties:
                              id:
                                type: string
                                format: uuid
                              phone:
                                type: string
                              name:
                                type: string
                                nullable: true
                              role:
                                type: string
                              isProfileComplete:
                                type: boolean
                              isNewUser:
                                type: boolean
        '401':
          description: OTP invalid or expired
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '422':
          $ref: '#/components/responses/ValidationError'

  /auth/refresh:
    post:
      tags: [auth]
      operationId: refreshToken
      summary: Issue new access token using refresh token cookie
      responses:
        '200':
          description: Token refreshed
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          accessToken:
                            type: string
        '401':
          description: Refresh token missing, invalid, or expired
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /auth/logout:
    post:
      tags: [auth]
      operationId: logout
      summary: Logout and clear refresh token
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Logged out successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SuccessResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

  # ── USERS ──────────────────────────────────────────────

  /users/me:
    get:
      tags: [users]
      operationId: getMyProfile
      summary: Get authenticated user profile
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Profile fetched
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/UserProfileResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

    patch:
      tags: [users]
      operationId: updateMyProfile
      summary: Update authenticated user profile
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateProfileRequest'
      responses:
        '200':
          description: Profile updated
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/UserProfileResponse'
        '409':
          description: Email already taken
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '422':
          $ref: '#/components/responses/ValidationError'

  /users/me/avatar:
    post:
      tags: [users]
      operationId: uploadAvatar
      summary: Upload user avatar image
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [avatar]
              properties:
                avatar:
                  type: string
                  format: binary
      responses:
        '200':
          description: Avatar uploaded
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          avatarUrl:
                            type: string
        '422':
          $ref: '#/components/responses/ValidationError'

  /users/me/wallet:
    get:
      tags: [users]
      operationId: getWallet
      summary: Get wallet balance and transaction history
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: type
          in: query
          schema:
            type: string
            enum: [credit, debit, all]
            default: all
      responses:
        '200':
          description: Wallet fetched
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/WalletResponse'
                      meta:
                        $ref: '#/components/schemas/PaginationMeta'

  # ── ASTROLOGERS ────────────────────────────────────────

  /astrologers:
    get:
      tags: [astrologers]
      operationId: listAstrologers
      summary: List and search astrologers
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 50 }
        - name: search
          in: query
          schema: { type: string }
        - name: skills
          in: query
          schema: { type: string }
          description: Comma-separated list of skills
        - name: available
          in: query
          schema: { type: boolean }
        - name: sortBy
          in: query
          schema:
            type: string
            enum: [rating, price, experience, sessions]
            default: rating
      responses:
        '200':
          description: Astrologers fetched
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/AstrologerListItemResponse'
                      meta:
                        $ref: '#/components/schemas/PaginationMeta'

  /astrologers/{id}:
    get:
      tags: [astrologers]
      operationId: getAstrologer
      summary: Get a single astrologer profile
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Astrologer fetched
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/AstrologerProfileResponse'
        '404':
          $ref: '#/components/responses/NotFound'

  /astrologers/{id}/reviews:
    get:
      tags: [astrologers, reviews]
      operationId: listAstrologerReviews
      summary: Get reviews for an astrologer
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
        - name: rating
          in: query
          schema: { type: integer, minimum: 1, maximum: 5 }
      responses:
        '200':
          description: Reviews fetched
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/ReviewResponse'
                      meta:
                        $ref: '#/components/schemas/PaginationMeta'

  # ── SESSIONS ───────────────────────────────────────────

  /sessions:
    post:
      tags: [sessions]
      operationId: requestSession
      summary: Request a session with an astrologer
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [astrologerId, type]
              properties:
                astrologerId:
                  type: string
                  format: uuid
                type:
                  type: string
                  enum: [chat, call, video]
      responses:
        '201':
          description: Session requested
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/SessionResponse'
        '402':
          description: Insufficient wallet balance
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: Astrologer not available or session already active
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /sessions/{id}/end:
    patch:
      tags: [sessions]
      operationId: endSession
      summary: End an active session
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Session ended
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          sessionId: { type: string, format: uuid }
                          durationMinutes: { type: integer }
                          totalCost: { type: integer }
                          walletBalance: { type: integer }
        '404':
          $ref: '#/components/responses/NotFound'

  # ── PAYMENTS ───────────────────────────────────────────

  /payments/orders:
    post:
      tags: [payments]
      operationId: createPaymentOrder
      summary: Create a Razorpay order to top up wallet
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [amount]
              properties:
                amount:
                  type: integer
                  minimum: 10000
                  maximum: 10000000
                  description: Amount in paise
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          orderId: { type: string }
                          amount: { type: integer }
                          currency: { type: string, example: INR }
                          keyId: { type: string }

  /payments/verify:
    post:
      tags: [payments]
      operationId: verifyPayment
      summary: Verify Razorpay payment and credit wallet
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
              properties:
                razorpayOrderId: { type: string }
                razorpayPaymentId: { type: string }
                razorpaySignature: { type: string }
      responses:
        '200':
          description: Payment verified and wallet credited
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          walletBalance: { type: integer }
                          credited: { type: integer }
        '400':
          description: Invalid payment signature
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  # ── REVIEWS ────────────────────────────────────────────

  /reviews:
    post:
      tags: [reviews]
      operationId: createReview
      summary: Submit a review for a completed session
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [sessionId, rating]
              properties:
                sessionId:
                  type: string
                  format: uuid
                rating:
                  type: integer
                  minimum: 1
                  maximum: 5
                comment:
                  type: string
                  maxLength: 500
      responses:
        '201':
          description: Review submitted
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SuccessResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/ReviewResponse'
        '409':
          description: Review already exists for this session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '422':
          $ref: '#/components/responses/ValidationError'

# ── SCHEMA COMPONENTS ─────────────────────────────────────

# (Add below existing components.schemas block)
#
# UserProfileResponse:
#   type: object
#   properties:
#     id: { type: string, format: uuid }
#     phone: { type: string }
#     name: { type: string, nullable: true }
#     email: { type: string, nullable: true }
#     avatarUrl: { type: string, nullable: true }
#     dateOfBirth: { type: string, format: date, nullable: true }
#     gender: { type: string, enum: [male, female, other], nullable: true }
#     zodiacSign: { type: string, nullable: true }
#     walletBalance: { type: integer, description: "Balance in paise" }
#     isProfileComplete: { type: boolean }
#     createdAt: { type: string, format: date-time }
#
# UpdateProfileRequest:
#   type: object
#   properties:
#     name: { type: string, minLength: 2, maxLength: 100 }
#     email: { type: string, format: email }
#     dateOfBirth: { type: string, format: date }
#     gender: { type: string, enum: [male, female, other] }
#     language: { type: string, enum: [en, hi, ta, te, bn] }
#
# AstrologerListItemResponse / AstrologerProfileResponse / SessionResponse /
# WalletResponse / ReviewResponse — add as you implement each module
```

---

## Workflow: Adding a New Endpoint

Follow these steps in order every single time:

```
Step 1 — Update the feature spec (.spec.md)
  Add endpoint definition, request/response shape, error cases

Step 2 — Add to openapi.yaml paths
  New path entry with operationId, tags, security, request, responses

Step 3 — Add to components/schemas
  Add any new request or response schema referenced in Step 2

Step 4 — Add new error codes to ErrorCode enum
  Any new error codes from the spec go into the enum

Step 5 — Write Zod schema
  Must match openapi.yaml requestBody schema exactly

Step 6 — Write code
  Service, repository, controller, routes

Step 7 — Validate sync
  Run: npx @stoplight/spectral-cli lint openapi.yaml
```

---

## Validation — Keep openapi.yaml Correct

### Install Spectral (linter for OpenAPI)
```bash
npm install --save-dev @stoplight/spectral-cli
```

### Add to package.json scripts
```json
{
  "scripts": {
    "lint:api": "spectral lint openapi.yaml",
    "docs": "npx @scalar/cli serve openapi.yaml",
    "postman": "npx openapi-to-postmanv2 -s openapi.yaml -o postman.json"
  }
}
```

### Run before every PR
```bash
npm run lint:api
```

---

## Swagger UI Setup (local dev)

```bash
npm install swagger-ui-express yaml
```

```js
// src/app.js
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

if (process.env.NODE_ENV !== 'production') {
  const spec = parse(readFileSync('./openapi.yaml', 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
```

Access at: `http://localhost:3000/docs`

---

## Postman Sync

Generate a Postman collection from openapi.yaml any time the spec changes:

```bash
npx openapi-to-postmanv2 -s openapi.yaml -o postman/astrotalk.json
```

Import `postman/astrotalk.json` into Postman. Commit it to git so the team always has an up-to-date collection.

---

## Contract Testing with Spectral

Add a `.spectral.yaml` at project root:

```yaml
extends: ['spectral:oas']
rules:
  operation-operationId: error
  operation-tags: error
  operation-success-response: error
  oas3-valid-schema-example: warn
  no-$ref-siblings: error
```

This enforces that every endpoint has an operationId, tags, and at least one success response — matching the spec file requirements.

---

## Cursor Workflow for openapi.yaml

In Cursor, when adding a new endpoint:

```
@openapi.yaml @specs/users.spec.md

The users spec has a new endpoint: GET /users/me/sessions
Add it to openapi.yaml following the existing patterns:
- operationId following the naming convention
- bearerAuth security
- PaginationMeta in response
- All error responses from the spec
```

When checking sync:
```
@openapi.yaml @specs/auth.spec.md @specs/users.spec.md

Check if all endpoints in both spec files are present in openapi.yaml.
List any that are missing or have mismatched response shapes.
```

---

## File Structure

```
astrotalk-backend/
├── openapi.yaml                    ← this file (maintained manually + Cursor)
├── .spectral.yaml                  ← OpenAPI linting rules
├── postman/
│   └── astrotalk.json              ← generated from openapi.yaml, committed to git
└── specs/
    └── *.spec.md                   ← source of truth → drives openapi.yaml
```

---

## What openapi.yaml Unlocks

| Tool              | Command                                      | What you get                        |
|-------------------|----------------------------------------------|-------------------------------------|
| Swagger UI        | `npm run docs`                               | Interactive API browser at /docs    |
| Postman           | `npm run postman`                            | Full collection with all endpoints  |
| Spectral          | `npm run lint:api`                           | Validates spec correctness          |
| Mock server       | `npx @stoplight/prism-cli mock openapi.yaml` | Fake API server from spec alone     |
| Client SDK        | `npx openapi-generator-cli generate ...`     | TypeScript/Swift/Kotlin SDK         |
| Contract tests    | Schemathesis / Dredd                         | Auto-test API against spec          |
