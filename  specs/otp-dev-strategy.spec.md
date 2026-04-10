# Spec: OTP Development & Testing Strategy

## Overview
Defines how OTP is handled across different environments.
In development/test, SMS is bypassed using a magic OTP code so developers
can test the full auth flow without a real SMS provider.

---

## Environment Behaviour Matrix

| Behaviour              | development        | test               | production         |
|------------------------|--------------------|--------------------|--------------------|
| OTP value              | OTP_MAGIC_CODE     | OTP_MAGIC_CODE     | Random 6-digit     |
| SMS sent               | ❌ No              | ❌ No              | ✅ Yes (Twilio)    |
| OTP logged to console  | ✅ Yes             | ❌ No              | ❌ Never           |
| OTP stored in Redis    | ✅ Yes             | ✅ Yes             | ✅ Yes             |
| Rate limiting active   | ❌ No              | ❌ No              | ✅ Yes             |

---

## Environment Variables

```env
# Controls OTP behaviour
NODE_ENV=development          # development | test | production

# Magic OTP (used in development + test only, ignored in production)
OTP_MAGIC_CODE=123456

# OTP config (all environments)
OTP_EXPIRY_SECONDS=300        # 5 minutes
OTP_LENGTH=6
OTP_RATE_LIMIT_MAX=3          # max sends per window
OTP_RATE_LIMIT_WINDOW=600     # 10 minutes in seconds
```

---

## Business Rules

### OTP Generation
- In `production`: generate a cryptographically random 6-digit numeric OTP
- In `development` or `test`: use value from `OTP_MAGIC_CODE` env var (default: `123456`)
- OTP is **never** stored in plain text — always store bcrypt hash in Redis

### SMS Sending
- In `production`: send OTP via configured SMS provider (Twilio/MSG91)
- In `development` or `test`: skip SMS entirely, log to console (dev only)
- Console log format: `[DEV OTP] Phone: {phone} → OTP: {otp}`
- **Never** log OTP in production — treat as sensitive credential

### Redis Storage (all environments)
- Key: `otp:{phone}`
- Value: bcrypt hash of OTP
- TTL: `OTP_EXPIRY_SECONDS` (default 300s)
- On successful verify: delete key immediately (one-time use)
- On new OTP request: overwrite existing key (restart timer)

### Rate Limiting
- Active in `production` only
- Max `OTP_RATE_LIMIT_MAX` sends per phone number per `OTP_RATE_LIMIT_WINDOW` seconds
- Rate limit key in Redis: `otp:ratelimit:{phone}`
- In `development` and `test`: rate limiting is disabled entirely

---

## OTP Generation Utility

```js
// src/utils/otp.js

import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generate OTP value based on environment
 * @returns {string} 6-digit OTP string
 */
export const generateOtp = () => {
  if (process.env.NODE_ENV !== 'production') {
    return process.env.OTP_MAGIC_CODE || '123456';
  }
  // Cryptographically random 6-digit number
  return String(crypto.randomInt(100000, 999999));
};

/**
 * Hash OTP for storage in Redis
 * @param {string} otp
 * @returns {Promise<string>} bcrypt hash
 */
export const hashOtp = (otp) => bcrypt.hash(otp, 10);

/**
 * Verify OTP against stored hash
 * @param {string} otp - plain OTP from user
 * @param {string} hash - bcrypt hash from Redis
 * @returns {Promise<boolean>}
 */
export const verifyOtp = (otp, hash) => bcrypt.compare(otp, hash);
```

---

## Service Logic (sendOtp)

```js
// Inside auth.service.js → sendOtp()

export const sendOtp = async (phone) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isDev  = process.env.NODE_ENV === 'development';

  // 1. Rate limit check (production only)
  if (isProd) {
    const rateLimitKey = `otp:ratelimit:${phone}`;
    const sends = await redis.incr(rateLimitKey);
    if (sends === 1) {
      await redis.expire(rateLimitKey, Number(process.env.OTP_RATE_LIMIT_WINDOW));
    }
    if (sends > Number(process.env.OTP_RATE_LIMIT_MAX)) {
      throw new AppError('Too many OTP requests. Try again later.', 429, 'OTP_RATE_LIMIT');
    }
  }

  // 2. Generate OTP
  const otp = generateOtp();

  // 3. Hash and store in Redis
  const otpHash = await hashOtp(otp);
  await redis.set(
    `otp:${phone}`,
    otpHash,
    'EX',
    Number(process.env.OTP_EXPIRY_SECONDS) || 300
  );

  // 4. Send SMS (production only)
  if (isProd) {
    await smsService.send(phone, `Your OTP is ${otp}. Valid for 5 minutes.`);
  }

  // 5. Log to console (development only)
  if (isDev) {
    console.log(`[DEV OTP] Phone: ${phone} → OTP: ${otp}`);
  }

  return { expiresIn: Number(process.env.OTP_EXPIRY_SECONDS) || 300 };
};
```

---

## How to Test Manually (Postman / Thunder Client)

### Step 1 — Send OTP
```
POST /api/v1/auth/send-otp
Content-Type: application/json

{
  "phone": "+919999999999"
}
```
Check terminal for: `[DEV OTP] Phone: +919999999999 → OTP: 123456`

### Step 2 — Verify OTP
```
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "phone": "+919999999999",
  "otp": "123456"
}
```
Response includes `accessToken`. Cookie `refreshToken` is set automatically.

### Step 3 — Test Protected Route
```
GET /api/v1/users/me
Authorization: Bearer {accessToken from step 2}
```

---

## Jest Test Cases

| #  | Scenario                                    | Environment | Expected                        |
|----|---------------------------------------------|-------------|---------------------------------|
| 1  | sendOtp in dev — OTP stored in Redis        | development | Redis key set, no SMS sent      |
| 2  | sendOtp in dev — magic OTP used             | development | OTP = OTP_MAGIC_CODE value      |
| 3  | sendOtp in prod — random OTP generated      | production  | OTP ≠ OTP_MAGIC_CODE            |
| 4  | sendOtp in prod — SMS service called        | production  | smsService.send() called once   |
| 5  | sendOtp in prod — rate limit not exceeded   | production  | 200, OTP sent                   |
| 6  | sendOtp in prod — rate limit exceeded       | production  | 429, OTP_RATE_LIMIT             |
| 7  | verifyOtp — correct magic OTP in dev        | development | 200, tokens issued              |
| 8  | verifyOtp — wrong OTP                       | development | 401, OTP_INVALID                |
| 9  | verifyOtp — expired OTP (Redis key gone)    | development | 401, OTP_EXPIRED                |
| 10 | verifyOtp — OTP deleted after use           | development | Redis key gone after success    |
| 11 | OTP never logged in production              | production  | console.log not called          |

---

## Security Rules

- OTP hash stored in Redis — never plain text
- OTP deleted from Redis immediately after successful verification (one-time use)
- New OTP request overwrites old hash — previous OTP instantly invalidated
- OTP never appears in API responses, logs, or error messages in production
- `OTP_MAGIC_CODE` env var must never be set in production `.env`

---

## .env.example Addition

```env
# ─── OTP Config ───────────────────────────────
OTP_EXPIRY_SECONDS=300
OTP_LENGTH=6
OTP_RATE_LIMIT_MAX=3
OTP_RATE_LIMIT_WINDOW=600

# Magic OTP for development/test only — NEVER set this in production
OTP_MAGIC_CODE=123456
```

---

## File Location

```
specs/otp-dev-strategy.spec.md    ← this file
src/utils/otp.js                  ← generateOtp, hashOtp, verifyOtp helpers
src/modules/auth/auth.service.js  ← sendOtp, verifyOtp service methods
```
