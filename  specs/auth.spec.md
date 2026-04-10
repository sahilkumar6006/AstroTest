# Spec: Auth Module

## Overview
Phone number based OTP authentication. No passwords.
Issues JWT access token (short-lived) + refresh token (long-lived, httpOnly cookie).

---

## Endpoints

---

### 1. Send OTP

**POST** `/api/v1/auth/send-otp`

**Auth Required:** No

**Request Body:**
```json
{
  "phone": "string (required, E.164 format, e.g. +919876543210)",
  "role": "string (optional, enum: user | astrologer, default: user)"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phone": "+919876543210",
    "expiresIn": 300
  }
}
```

**Business Rules:**
- Generate a 6-digit numeric OTP
- OTP expires in 5 minutes
- Store OTP hash (not plain) in Redis with key `otp:{phone}` with 5 min TTL
- Rate limit: 3 OTP sends per phone number per 10 minutes
- In development/test: always use OTP `123456`, skip SMS

**Error Cases:**
| Condition              | Status | Code                  |
|------------------------|--------|-----------------------|
| Invalid phone format   | 422    | VALIDATION_ERROR      |
| Rate limit exceeded    | 429    | OTP_RATE_LIMIT        |
| SMS service failure    | 500    | SMS_SEND_FAILED       |

**Dependencies:** Redis, Twilio/MSG91

---

### 2. Verify OTP (Login / Register)

**POST** `/api/v1/auth/verify-otp`

**Auth Required:** No

**Request Body:**
```json
{
  "phone": "string (required)",
  "otp": "string (required, 6 digits)",
  "role": "string (optional, enum: user | astrologer, default: user)"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "phone": "+919876543210",
      "name": null,
      "role": "user",
      "isProfileComplete": false,
      "isNewUser": true
    }
  }
}
```
Refresh token is set as httpOnly cookie: `refreshToken`.

**Business Rules:**
- Verify OTP hash from Redis
- Delete OTP from Redis on successful verify (one-time use)
- If user with phone+role doesn't exist → create new user (isNewUser: true)
- If user exists → login (isNewUser: false)
- Issue accessToken (JWT, 15 min) + refreshToken (random UUID, 7 days)
- Store refreshToken hash in DB table `refresh_tokens`
- Set cookie: `refreshToken`, httpOnly, secure, sameSite=strict, maxAge=7days
- isProfileComplete = false if name is null

**Error Cases:**
| Condition              | Status | Code                  |
|------------------------|--------|-----------------------|
| OTP not found/expired  | 401    | OTP_EXPIRED           |
| Invalid OTP            | 401    | OTP_INVALID           |
| User account banned    | 403    | ACCOUNT_BANNED        |

---

### 3. Refresh Access Token

**POST** `/api/v1/auth/refresh`

**Auth Required:** No (uses httpOnly cookie)

**Request:** No body. Refresh token read from cookie `refreshToken`.

**Success Response — 200**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGci..."
  }
}
```
New refresh token is rotated and set as new httpOnly cookie.

**Business Rules:**
- Read `refreshToken` from cookie
- Hash it and lookup in `refresh_tokens` table
- Verify token is not expired and not revoked
- Issue new accessToken + rotate refreshToken (old one deleted, new one stored)
- Refresh token rotation: each refresh token can only be used once

**Error Cases:**
| Condition              | Status | Code                  |
|------------------------|--------|-----------------------|
| Cookie missing         | 401    | REFRESH_TOKEN_MISSING |
| Token not in DB        | 401    | REFRESH_TOKEN_INVALID |
| Token expired          | 401    | REFRESH_TOKEN_EXPIRED |

---

### 4. Logout

**POST** `/api/v1/auth/logout`

**Auth Required:** Yes (Bearer token)

**Request:** No body.

**Success Response — 200**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

**Business Rules:**
- Delete refresh token from DB (using token from cookie)
- Clear `refreshToken` cookie
- Access token is stateless — it expires naturally (no blacklist needed)

---

## DB Schema

### Table: `users`
```
id            UUID          PK default gen_random_uuid()
phone         VARCHAR(20)   UNIQUE NOT NULL
role          ENUM          (user, astrologer, admin) default 'user'
name          VARCHAR(100)
email         VARCHAR(255)
avatarUrl     TEXT
isBanned      BOOLEAN       default false
createdAt     TIMESTAMP     default now()
updatedAt     TIMESTAMP
deletedAt     TIMESTAMP     (soft delete)
```

### Table: `refresh_tokens`
```
id            UUID          PK
userId        UUID          FK → users.id
tokenHash     VARCHAR(255)  UNIQUE NOT NULL  (SHA256 of raw token)
expiresAt     TIMESTAMP     NOT NULL
createdAt     TIMESTAMP     default now()
revokedAt     TIMESTAMP     (null = active)
```

---

## Zod Schemas

```js
// auth.schema.js

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number'),
    role: z.enum(['user', 'astrologer']).optional().default('user'),
  })
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number'),
    otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
    role: z.enum(['user', 'astrologer']).optional().default('user'),
  })
});
```

---

## File Structure

```
src/modules/auth/
├── auth.routes.js
├── auth.controller.js
├── auth.service.js
├── auth.repository.js
├── auth.schema.js
└── auth.test.js
```

---

## Test Cases

| #  | Scenario                             | Expected                    |
|----|--------------------------------------|-----------------------------|
| 1  | Send OTP with valid phone            | 200, OTP stored in Redis    |
| 2  | Send OTP with invalid phone format   | 422, VALIDATION_ERROR       |
| 3  | Send OTP 4th time in 10 min          | 429, OTP_RATE_LIMIT         |
| 4  | Verify correct OTP (new user)        | 200, isNewUser: true        |
| 5  | Verify correct OTP (existing user)   | 200, isNewUser: false       |
| 6  | Verify wrong OTP                     | 401, OTP_INVALID            |
| 7  | Verify expired OTP                   | 401, OTP_EXPIRED            |
| 8  | Refresh with valid cookie            | 200, new accessToken        |
| 9  | Refresh with invalid cookie          | 401, REFRESH_TOKEN_INVALID  |
| 10 | Logout clears cookie and DB record   | 200, cookie cleared         |
