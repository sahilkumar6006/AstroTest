# Spec: Sessions Module

## Overview
A session is a paid interaction between a user and astrologer.
Types: chat, call, video. Billing is per-minute from the user's wallet.

---

## Session Lifecycle

```
User requests session
  → System checks user wallet balance (must cover min 3 minutes)
  → System checks astrologer availability
  → Session created with status: PENDING
  → Astrologer notified via Socket.io
  → Astrologer accepts → status: ACTIVE, timer starts
  → Astrologer rejects / no response in 30s → status: CANCELLED
  → During session: wallet deducted every 60 seconds
  → Either party ends session → status: COMPLETED
  → If wallet hits 0 during session → auto-end → status: COMPLETED
```

---

## Session Statuses
```
PENDING     → waiting for astrologer to accept
ACTIVE      → session in progress
COMPLETED   → ended normally
CANCELLED   → rejected or timed out
FAILED      → payment/system error
```

---

## Endpoints

### 1. Request Session

**POST** `/api/v1/sessions`

**Auth Required:** Yes (role: user)

**Request Body:**
```json
{
  "astrologerId": "uuid",
  "type": "chat | call | video"
}
```

**Success Response — 201**
```json
{
  "success": true,
  "message": "Session requested",
  "data": {
    "sessionId": "uuid",
    "status": "PENDING",
    "astrologer": { "id": "uuid", "name": "...", "avatarUrl": "..." },
    "type": "chat",
    "pricePerMin": 1500,
    "walletBalance": 50000,
    "maxMinutes": 33
  }
}
```

**Business Rules:**
- User wallet must have balance ≥ (pricePerMin × 3) — minimum 3 minutes
- Astrologer must be online and available
- User cannot have another ACTIVE or PENDING session
- Astrologer cannot be in another ACTIVE session
- Notify astrologer via Socket.io event `session:requested`
- Auto-cancel if astrologer doesn't respond in 30 seconds

**Error Cases:**
| Condition                 | Status | Code                        |
|---------------------------|--------|-----------------------------|
| Insufficient wallet       | 402    | INSUFFICIENT_WALLET         |
| Astrologer not available  | 409    | ASTROLOGER_NOT_AVAILABLE    |
| User session already open | 409    | SESSION_ALREADY_ACTIVE      |

---

### 2. Get Session Detail

**GET** `/api/v1/sessions/:id`

**Auth Required:** Yes (user who owns it OR the astrologer in it)

**Success Response — 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "chat",
    "status": "COMPLETED",
    "pricePerMin": 1500,
    "durationMinutes": 12,
    "totalCost": 18000,
    "startedAt": "...",
    "endedAt": "...",
    "user": { "id": "...", "name": "..." },
    "astrologer": { "id": "...", "name": "..." }
  }
}
```

---

### 3. End Session

**PATCH** `/api/v1/sessions/:id/end`

**Auth Required:** Yes (user or astrologer of this session)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Session ended",
  "data": {
    "sessionId": "uuid",
    "durationMinutes": 12,
    "totalCost": 18000,
    "walletBalance": 32000
  }
}
```

**Business Rules:**
- Calculate exact duration in minutes (round up)
- Deduct final amount from user wallet
- Credit astrologer earnings (70% of session cost)
- Emit Socket.io event `session:ended` to both parties
- Create wallet_transaction records for both

---

## DB Schema

### Table: `sessions`
```
id              UUID        PK
userId          UUID        FK → users.id
astrologerId    UUID        FK → users.id
type            ENUM        (chat, call, video)
status          ENUM        (PENDING, ACTIVE, COMPLETED, CANCELLED, FAILED)
pricePerMin     INTEGER     -- paise, snapshot at session start
startedAt       TIMESTAMP
endedAt         TIMESTAMP
durationSeconds INTEGER     -- exact duration
totalCost       INTEGER     -- paise (calculated at end)
cancelReason    TEXT
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
deletedAt       TIMESTAMP
```

---

---

# Spec: Payments Module

## Overview
Wallet top-up via Razorpay. All amounts in paise (₹1 = 100 paise).

---

## Endpoints

### 1. Create Payment Order

**POST** `/api/v1/payments/orders`

**Auth Required:** Yes (role: user)

**Request Body:**
```json
{
  "amount": 50000
}
```
Amount in paise. Min: 10000 (₹100). Max: 10000000 (₹1,00,000).

**Success Response — 201**
```json
{
  "success": true,
  "data": {
    "orderId": "order_Razorpay123",
    "amount": 50000,
    "currency": "INR",
    "keyId": "rzp_live_xxx"
  }
}
```

**Business Rules:**
- Create Razorpay order via API
- Store order in `payment_orders` table with status PENDING

---

### 2. Verify Payment

**POST** `/api/v1/payments/verify`

**Auth Required:** Yes (role: user)

**Request Body:**
```json
{
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "hash_xxx"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Payment successful. Wallet credited.",
  "data": {
    "walletBalance": 100000,
    "credited": 50000
  }
}
```

**Business Rules:**
- Verify HMAC signature: `hmac_sha256(orderId + "|" + paymentId, keySecret)`
- If valid → update order status to SUCCESS → credit user wallet → create wallet_transaction
- Idempotent: if payment already processed, return success without double-crediting
- If signature invalid → update order status to FAILED → return 400

---

## DB Schema

### Table: `payment_orders`
```
id                  UUID        PK
userId              UUID        FK → users.id
razorpayOrderId     VARCHAR     UNIQUE
razorpayPaymentId   VARCHAR     UNIQUE
amount              INTEGER
currency            VARCHAR(3)  default 'INR'
status              ENUM        (PENDING, SUCCESS, FAILED)
createdAt           TIMESTAMP
updatedAt           TIMESTAMP
```

---

---

# Spec: Reviews Module

## Overview
Users can leave a rating + comment for an astrologer after a COMPLETED session.
One review per session maximum.

---

## Endpoints

### 1. Create Review

**POST** `/api/v1/reviews`

**Auth Required:** Yes (role: user)

**Request Body:**
```json
{
  "sessionId": "uuid",
  "rating": 5,
  "comment": "Very helpful and accurate predictions!"
}
```

**Success Response — 201**
```json
{
  "success": true,
  "message": "Review submitted",
  "data": {
    "id": "uuid",
    "rating": 5,
    "comment": "...",
    "createdAt": "..."
  }
}
```

**Business Rules:**
- Session must be COMPLETED and belong to the requesting user
- One review per session (unique constraint on sessionId)
- After creating review, recalculate astrologer's average rating and totalReviews

**Error Cases:**
| Condition               | Status | Code                    |
|-------------------------|--------|-------------------------|
| Session not found       | 404    | SESSION_NOT_FOUND       |
| Session not completed   | 422    | SESSION_NOT_COMPLETED   |
| Review already exists   | 409    | REVIEW_ALREADY_EXISTS   |

---

### 2. Get Astrologer Reviews

**GET** `/api/v1/astrologers/:id/reviews`

**Auth Required:** No

**Query Params:** `page`, `limit`, `rating` (filter by 1-5)

**Success Response — 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Excellent!",
      "user": { "name": "Rahul S.", "avatarUrl": "..." },
      "createdAt": "..."
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1240, "totalPages": 62 }
}
```

**Business Rules:**
- User name shown as first name + last initial only (privacy)
- Reviews sorted by newest first by default

---

## DB Schema

### Table: `reviews`
```
id              UUID        PK
sessionId       UUID        FK → sessions.id UNIQUE
userId          UUID        FK → users.id
astrologerId    UUID        FK → users.id
rating          SMALLINT    NOT NULL CHECK (rating >= 1 AND rating <= 5)
comment         TEXT        max 500 chars
createdAt       TIMESTAMP
```
