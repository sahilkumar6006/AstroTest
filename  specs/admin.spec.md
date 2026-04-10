# Spec: Admin Module

## Overview
Admin-only endpoints for platform management: user oversight, astrologer verification,
platform statistics, and content moderation.

All endpoints require a valid JWT with `role: admin`. Any non-admin request is rejected
with 403 FORBIDDEN before any business logic runs.

---

## Role Guard

Admin routes are protected by two middleware layers in order:
1. `authenticate` — validates JWT and attaches `req.user`
2. `requireAdmin` — checks `req.user.role === 'admin'`, throws `AppError(403, FORBIDDEN)` otherwise

`requireAdmin` lives in `src/middlewares/requireAdmin.ts` and is imported by `admin.routes.ts` only.

---

## Endpoints

---

### 1. Get Platform Stats

**GET** `/api/v1/admin/stats`

**Auth Required:** Yes (role: admin)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Stats fetched",
  "data": {
    "users": {
      "total": 12400,
      "active": 9800,
      "banned": 15,
      "newToday": 34
    },
    "astrologers": {
      "total": 320,
      "verified": 290,
      "pendingVerification": 30,
      "online": 45
    },
    "sessions": {
      "totalCompleted": 58000,
      "today": 210,
      "activeNow": 12
    },
    "revenue": {
      "totalPaise": 1250000000,
      "todayPaise": 450000,
      "platformFeePaise": 375000000
    }
  }
}
```

**Business Rules:**
- Revenue amounts in paise (integers)
- `activeNow` is derived from sessions with status ACTIVE
- `online` astrologers derived from Redis availability keys

---

### 2. List Users

**GET** `/api/v1/admin/users`

**Auth Required:** Yes (role: admin)

**Query Params:**
```
page      integer   default 1
limit     integer   default 20, max 100
search    string    search by name or phone (partial match)
role      string    user | astrologer | admin
isBanned  boolean   filter banned/active accounts
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Users fetched",
  "data": [
    {
      "id": "uuid",
      "phone": "+919876543210",
      "name": "Rahul Sharma",
      "role": "user",
      "walletBalancePaise": 50000,
      "isBanned": false,
      "isProfileComplete": true,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 12400, "totalPages": 620 }
}
```

---

### 3. Get User Detail

**GET** `/api/v1/admin/users/:id`

**Auth Required:** Yes (role: admin)

**Success Response — 200**
```json
{
  "success": true,
  "message": "User fetched",
  "data": {
    "id": "uuid",
    "phone": "+919876543210",
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "role": "user",
    "gender": "male",
    "dateOfBirth": "1990-05-15",
    "zodiacSign": "taurus",
    "language": "hi",
    "avatarUrl": "...",
    "walletBalancePaise": 50000,
    "isBanned": false,
    "isProfileComplete": true,
    "createdAt": "2024-01-01T10:00:00Z",
    "totalSessions": 12,
    "totalSpentPaise": 180000
  }
}
```

**Error Cases:**
| Condition      | Status | Code           |
|----------------|--------|----------------|
| User not found | 404    | USER_NOT_FOUND |

---

### 4. Ban or Unban User

**PATCH** `/api/v1/admin/users/:id/ban`

**Auth Required:** Yes (role: admin)

**Request Body:**
```json
{
  "isBanned": true,
  "reason": "Fraudulent payment activity"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "User banned",
  "data": { "id": "uuid", "isBanned": true }
}
```

**Business Rules:**
- `reason` is required when `isBanned: true`, optional when unbanning
- Banning does not delete sessions or wallet transactions (soft approach only)
- Banned users cannot authenticate (auth module checks `isBanned` on verify-otp and refresh)
- Any currently active sessions for this user are NOT auto-ended — admin must handle manually
- Admin cannot ban another admin

**Error Cases:**
| Condition            | Status | Code                  |
|----------------------|--------|-----------------------|
| User not found       | 404    | USER_NOT_FOUND        |
| Trying to ban admin  | 422    | CANNOT_BAN_ADMIN      |

---

### 5. List Astrologers (Pending Verification)

**GET** `/api/v1/admin/astrologers`

**Auth Required:** Yes (role: admin)

**Query Params:**
```
page        integer   default 1
limit       integer   default 20, max 100
isVerified  boolean   filter by verification status (omit = all)
search      string    search by name
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Astrologers fetched",
  "data": [
    {
      "id": "uuid",
      "name": "Pandit Rajesh Sharma",
      "phone": "+919876543210",
      "avatarUrl": "...",
      "bio": "...",
      "skills": ["vedic", "tarot"],
      "experience": 8,
      "isVerified": false,
      "totalSessions": 0,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 30, "totalPages": 2 }
}
```

---

### 6. Verify or Reject Astrologer Profile

**PATCH** `/api/v1/admin/astrologers/:id/verify`

**Auth Required:** Yes (role: admin)

**Request Body:**
```json
{
  "isVerified": true,
  "note": "Credentials reviewed and approved"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Astrologer profile verified",
  "data": { "id": "uuid", "isVerified": true }
}
```

**Business Rules:**
- `:id` is the user UUID (not astrologer_profile UUID — both are the same per the schema)
- User must have `role: astrologer` and an existing `astrologer_profiles` row
- On approval (`isVerified: true`) → trigger `PROFILE_APPROVED` notification to the astrologer
- On rejection (`isVerified: false`) → no notification (admin uses external channel)
- Unverified astrologers are visible in public listing but marked as unverified

**Error Cases:**
| Condition                     | Status | Code                     |
|-------------------------------|--------|--------------------------|
| User not found                | 404    | USER_NOT_FOUND           |
| User is not an astrologer     | 422    | NOT_AN_ASTROLOGER        |
| Astrologer profile not found  | 404    | ASTROLOGER_NOT_FOUND     |

---

## Zod Schemas

```ts
export const adminBanUserSchema = z.object({
  body: z.object({
    isBanned: z.boolean(),
    reason: z.string().min(1).max(500).optional(),
  }).refine(
    (data) => !data.isBanned || !!data.reason,
    { message: 'reason is required when banning a user', path: ['reason'] }
  ),
});

export const adminVerifyAstrologerSchema = z.object({
  body: z.object({
    isVerified: z.boolean(),
    note: z.string().max(500).optional(),
  }),
});

export const adminUserListQuerySchema = z.object({
  query: z.object({
    page:     z.coerce.number().int().positive().default(1),
    limit:    z.coerce.number().int().min(1).max(100).default(20),
    search:   z.string().optional(),
    role:     z.enum(['user', 'astrologer', 'admin']).optional(),
    isBanned: z.coerce.boolean().optional(),
  }),
});

export const adminAstrologerListQuerySchema = z.object({
  query: z.object({
    page:       z.coerce.number().int().positive().default(1),
    limit:      z.coerce.number().int().min(1).max(100).default(20),
    search:     z.string().optional(),
    isVerified: z.coerce.boolean().optional(),
  }),
});
```

---

## File Structure

```
src/modules/admin/
├── admin.schema.ts
├── admin.repository.ts
├── admin.service.ts
├── admin.controller.ts
└── admin.routes.ts

src/middlewares/
└── requireAdmin.ts    ← role guard, imported only by admin.routes.ts
```

---

## Error Code Registry

| Code                  | Status | Meaning                                   |
|-----------------------|--------|-------------------------------------------|
| FORBIDDEN             | 403    | Non-admin tried to access admin endpoint  |
| USER_NOT_FOUND        | 404    | No user with given id                     |
| CANNOT_BAN_ADMIN      | 422    | Cannot ban a user with role: admin        |
| NOT_AN_ASTROLOGER     | 422    | User does not have astrologer role        |
| ASTROLOGER_NOT_FOUND  | 404    | astrologer_profiles row not found         |

---

## Test Cases

| #  | Scenario                                          | Expected                                    |
|----|---------------------------------------------------|---------------------------------------------|
| 1  | GET /admin/stats as admin                         | 200 with all counts                         |
| 2  | GET /admin/stats as user                          | 403 FORBIDDEN                               |
| 3  | GET /admin/users — paginated                      | Correct user list with meta                 |
| 4  | GET /admin/users?isBanned=true                    | Only banned users returned                  |
| 5  | GET /admin/users/:id — exists                     | Full user detail                            |
| 6  | GET /admin/users/:id — not found                  | 404 USER_NOT_FOUND                          |
| 7  | PATCH /admin/users/:id/ban — ban with reason      | User banned, isBanned: true                 |
| 8  | PATCH /admin/users/:id/ban — ban without reason   | 422 VALIDATION_ERROR                        |
| 9  | PATCH /admin/users/:id/ban — unban                | User unbanned, isBanned: false              |
| 10 | PATCH /admin/users/:id/ban — ban another admin    | 422 CANNOT_BAN_ADMIN                        |
| 11 | GET /admin/astrologers?isVerified=false           | Pending astrologers only                    |
| 12 | PATCH /admin/astrologers/:id/verify — approve     | isVerified: true, PROFILE_APPROVED sent     |
| 13 | PATCH /admin/astrologers/:id/verify — not astro   | 422 NOT_AN_ASTROLOGER                       |
| 14 | Any admin route with no token                     | 401 UNAUTHORIZED                            |
| 15 | Any admin route with user token                   | 403 FORBIDDEN                               |
