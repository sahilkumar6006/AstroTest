# Spec: Users Module

## Overview
User profile management, wallet balance, and preferences.
Users are created automatically during OTP verification.

---

## Endpoints

---

### 1. Get My Profile

**GET** `/api/v1/users/me`

**Auth Required:** Yes (role: user)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "id": "uuid",
    "phone": "+919876543210",
    "name": "Rahul Sharma",
    "email": "rahul@gmail.com",
    "avatarUrl": "https://s3.../avatar.jpg",
    "dateOfBirth": "1995-06-15",
    "gender": "male",
    "zodiacSign": "gemini",
    "walletBalance": 50000,
    "isProfileComplete": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 2. Update My Profile

**PATCH** `/api/v1/users/me`

**Auth Required:** Yes (role: user)

**Request Body (all fields optional):**
```json
{
  "name": "string (min 2, max 100)",
  "email": "string (valid email)",
  "dateOfBirth": "string (YYYY-MM-DD, must be past date)",
  "gender": "string (enum: male | female | other)",
  "language": "string (enum: en | hi | ta | te | bn)"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": { ...updatedUser }
}
```

**Business Rules:**
- Zodiac sign auto-calculated from dateOfBirth on update
- isProfileComplete = true when name + dateOfBirth + gender are all set
- Email uniqueness enforced if provided

**Error Cases:**
| Condition           | Status | Code              |
|---------------------|--------|-------------------|
| Email already taken | 409    | EMAIL_TAKEN       |
| Invalid DOB format  | 422    | VALIDATION_ERROR  |
| Future DOB          | 422    | VALIDATION_ERROR  |

---

### 3. Upload Avatar

**POST** `/api/v1/users/me/avatar`

**Auth Required:** Yes (role: user)

**Request:** multipart/form-data
- `avatar`: image file (jpg/png/webp, max 5MB)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Avatar uploaded",
  "data": {
    "avatarUrl": "https://s3.amazonaws.com/bucket/avatars/uuid.jpg"
  }
}
```

**Business Rules:**
- Resize to 400x400 before uploading to S3
- Delete old avatar from S3 if exists
- Allowed types: image/jpeg, image/png, image/webp

**Error Cases:**
| Condition        | Status | Code                |
|------------------|--------|---------------------|
| No file uploaded | 422    | VALIDATION_ERROR    |
| File too large   | 422    | FILE_TOO_LARGE      |
| Invalid type     | 422    | INVALID_FILE_TYPE   |

---

### 4. Get Wallet Balance

**GET** `/api/v1/users/me/wallet`

**Auth Required:** Yes (role: user)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Wallet fetched",
  "data": {
    "balance": 50000,
    "balanceFormatted": "₹500.00",
    "transactions": [
      {
        "id": "uuid",
        "type": "credit",
        "amount": 100000,
        "description": "Wallet top-up via Razorpay",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

**Query Params:**
- `page`, `limit`, `type` (credit | debit | all)

---

### 5. Get Session History

**GET** `/api/v1/users/me/sessions`

**Auth Required:** Yes (role: user)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Sessions fetched",
  "data": [
    {
      "id": "uuid",
      "astrologer": {
        "id": "uuid",
        "name": "Pandit Ji",
        "avatarUrl": "..."
      },
      "type": "chat",
      "status": "completed",
      "durationMinutes": 12,
      "totalCost": 4800,
      "startedAt": "2024-01-01T10:00:00Z",
      "endedAt": "2024-01-01T10:12:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 }
}
```

---

## DB Schema (additions to users table)

```
dateOfBirth   DATE
gender        ENUM (male, female, other)
zodiacSign    ENUM (aries, taurus, gemini, cancer, leo, virgo,
                    libra, scorpio, sagittarius, capricorn, aquarius, pisces)
language      ENUM (en, hi, ta, te, bn) default 'hi'
walletBalance INTEGER  default 0  -- stored in paise
```

### Table: `wallet_transactions`
```
id            UUID        PK
userId        UUID        FK → users.id
type          ENUM        (credit, debit)
amount        INTEGER     NOT NULL  -- in paise, always positive
balanceAfter  INTEGER     NOT NULL
description   TEXT
referenceId   UUID        -- sessionId or paymentId
createdAt     TIMESTAMP   default now()
```

---

## Zod Schemas

```js
export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    dateOfBirth: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(d => new Date(d) < new Date(), 'DOB must be in the past')
      .optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    language: z.enum(['en', 'hi', 'ta', 'te', 'bn']).optional(),
  })
});

export const walletQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(['credit', 'debit', 'all']).default('all'),
  })
});
```

---

## File Structure

```
src/modules/users/
├── users.routes.js
├── users.controller.js
├── users.service.js
├── users.repository.js
├── users.schema.js
└── users.test.js
```
