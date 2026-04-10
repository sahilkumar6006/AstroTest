# AstroTalk Clone — Backend Project Spec

## 1. Project Overview

A platform connecting users with astrologers for live chat, voice calls, and video consultations.
Users can browse astrologer profiles, book sessions, make payments, and get horoscope content.

---

## 2. Tech Stack

| Layer           | Technology                        |
|-----------------|-----------------------------------|
| Runtime         | Node.js v20+                      |
| Framework       | Express.js v4                     |
| Language        | JavaScript (ESM modules)          |
| Primary DB      | PostgreSQL 15                     |
| ORM             | Prisma                            |
| Cache           | Redis (sessions, rate limiting, socket presence) |
| Auth            | JWT (access) + Refresh Tokens     |
| Real-time       | Socket.io                         |
| File Storage    | AWS S3 (profile photos, media)    |
| Payments        | Razorpay                          |
| SMS/OTP         | Twilio / MSG91                    |
| Email           | Nodemailer + SendGrid             |
| Validation      | Zod                               |
| API Docs        | Swagger (openapi.yaml)            |
| Testing         | Jest + Supertest                  |

---

## 3. Architecture

```
src/
├── config/           # env, db, redis, s3 config
├── modules/          # feature modules (auth, users, astrologers, etc.)
│   └── {module}/
│       ├── {module}.routes.js      # Express router
│       ├── {module}.controller.js  # Request/response handling
│       ├── {module}.service.js     # Business logic
│       ├── {module}.repository.js  # DB queries (Prisma)
│       ├── {module}.schema.js      # Zod validation schemas
│       └── {module}.test.js        # Jest tests
├── middlewares/      # auth, error handler, rate limiter, upload
├── utils/            # helpers (jwt, hash, paginate, response)
├── socket/           # Socket.io event handlers
├── jobs/             # Background jobs (cron, queues)
├── prisma/
│   └── schema.prisma
├── specs/            # Feature spec files (this folder)
├── openapi.yaml      # OpenAPI 3.1 contract
└── app.js            # Express app entry point
```

---

## 4. Modules (Domains)

| Module         | Description                                          |
|----------------|------------------------------------------------------|
| auth           | OTP login, JWT issue/refresh, logout                 |
| users          | User profile, wallet, preferences                    |
| astrologers    | Astrologer profiles, skills, availability, ratings   |
| sessions       | Book/start/end chat & call sessions                  |
| chat           | Real-time chat via Socket.io                         |
| calls          | Voice/video call signaling via Socket.io/WebRTC      |
| payments       | Wallet top-up, session billing, refunds (Razorpay)   |
| reviews        | Ratings and reviews for astrologers                  |
| horoscope      | Daily/weekly horoscope content per zodiac sign       |
| notifications  | Push notifications, in-app alerts                    |
| admin          | Admin dashboard: users, astrologers, transactions    |

---

## 5. API Conventions

### Base URL
```
/api/v1/{module}
```

### Response Envelope (ALL responses must follow this)
```json
{
  "success": true,
  "message": "Human readable message",
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
`meta` is only present on paginated responses.

### Error Response Envelope
```json
{
  "success": false,
  "message": "Human readable error message",
  "code": "ERROR_CODE_SNAKE_UPPER",
  "errors": [ ]
}
```
`errors` is an array of field-level validation errors (only for 422).

### HTTP Status Codes
| Status | When                                          |
|--------|-----------------------------------------------|
| 200    | Successful GET / UPDATE                       |
| 201    | Successful POST (resource created)            |
| 204    | Successful DELETE (no body)                   |
| 400    | Bad request (malformed JSON, missing params)  |
| 401    | Unauthenticated (missing/invalid token)       |
| 403    | Forbidden (authenticated but not authorized)  |
| 404    | Resource not found                            |
| 409    | Conflict (duplicate resource)                 |
| 422    | Validation error (field-level errors)         |
| 429    | Rate limit exceeded                           |
| 500    | Internal server error                         |

### Pagination (list endpoints)
All list endpoints accept:
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `sortBy` (field name)
- `sortOrder` (asc | desc)

---

## 6. Authentication Flow

```
User sends phone number
  → OTP sent via SMS
  → User submits OTP
  → Server issues: accessToken (15min) + refreshToken (7 days)
  → refreshToken stored in DB + httpOnly cookie
  → On expiry: POST /auth/refresh issues new pair
  → Logout: refreshToken deleted from DB + cookie cleared
```

All protected routes require:
```
Authorization: Bearer <accessToken>
```

### Token Payloads
**Access Token:**
```json
{ "sub": "user_uuid", "role": "user|astrologer|admin", "iat": 0, "exp": 0 }
```

**Refresh Token:** opaque random string (stored in DB, hashed)

---

## 7. Roles & Permissions

| Role        | Access                                                   |
|-------------|----------------------------------------------------------|
| user        | Browse, book sessions, chat, pay, review                 |
| astrologer  | Manage profile, accept sessions, view earnings           |
| admin       | Full access to all modules                               |

---

## 8. Coding Conventions

- **File naming:** camelCase for files, PascalCase for classes
- **Functions:** async/await everywhere, no raw callbacks
- **Errors:** Always throw AppError (custom class) — never raw Error in services
- **Validation:** Zod schema validates ALL incoming request body/query/params
- **DB access:** Only via repository layer — no Prisma calls in controllers/services
- **Secrets:** Never hardcoded — always from process.env
- **Logs:** Use Winston logger (never console.log in production code)

### AppError Class
```js
throw new AppError('User not found', 404, 'USER_NOT_FOUND');
// AppError(message, statusCode, code)
```

### Repository Pattern
```js
// repository.js — only DB logic
const findById = async (id) => prisma.user.findUnique({ where: { id } });

// service.js — business logic calls repository
const getUser = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};
```

---

## 9. Environment Variables

```env
# App
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/astrotalk

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# Twilio / OTP
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

## 10. Rate Limits

| Endpoint Group    | Limit                |
|-------------------|----------------------|
| OTP send          | 3 requests / 10 min / IP |
| Auth endpoints    | 10 requests / min / IP   |
| General API       | 100 requests / min / user |
| File uploads      | 10 requests / min / user  |

---

## 11. Non-Functional Requirements

- All timestamps stored as UTC in DB
- Soft deletes on User, Astrologer, Session (deletedAt column)
- UUIDs as primary keys everywhere
- All money values stored as integers in paise (₹1 = 100 paise)
- Wallet balance can never go below 0
- Session billing charged per minute, deducted from user wallet in real-time
