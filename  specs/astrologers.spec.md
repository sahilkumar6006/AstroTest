# Spec: Astrologers Module

## Overview
Astrologer profiles, skills, availability status, pricing, and search/filter.
Astrologers are also users (role: astrologer) with an extended profile.

---

## Endpoints

---

### 1. List / Search Astrologers

**GET** `/api/v1/astrologers`

**Auth Required:** No

**Query Params:**
```
page          integer   default 1
limit         integer   default 20, max 50
search        string    search by name
skills        string[]  filter by skill (e.g. vedic,tarot,numerology)
language      string[]  filter by language
minRating     number    filter by minimum rating (1-5)
maxPrice      integer   max price per minute in paise
available     boolean   only show currently online astrologers
sortBy        string    rating | price | experience | sessions
sortOrder     string    asc | desc
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
      "avatarUrl": "...",
      "skills": ["vedic", "palmistry"],
      "languages": ["hi", "en"],
      "experience": 8,
      "rating": 4.7,
      "totalReviews": 1240,
      "totalSessions": 5600,
      "chatPricePerMin": 1500,
      "callPricePerMin": 2000,
      "videoPricePerMin": 2500,
      "isOnline": true,
      "isAvailable": true,
      "waitingUsers": 3
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

---

### 2. Get Astrologer Profile

**GET** `/api/v1/astrologers/:id`

**Auth Required:** No

**Success Response — 200**
```json
{
  "success": true,
  "message": "Astrologer fetched",
  "data": {
    "id": "uuid",
    "name": "Pandit Rajesh Sharma",
    "avatarUrl": "...",
    "coverImageUrl": "...",
    "bio": "20 years of experience in Vedic astrology...",
    "skills": ["vedic", "palmistry", "tarot"],
    "languages": ["hi", "en"],
    "experience": 8,
    "rating": 4.7,
    "totalReviews": 1240,
    "totalSessions": 5600,
    "chatPricePerMin": 1500,
    "callPricePerMin": 2000,
    "videoPricePerMin": 2500,
    "isOnline": true,
    "isAvailable": true,
    "waitingUsers": 3,
    "recentReviews": [ ...top 3 reviews... ]
  }
}
```

**Error Cases:**
| Condition            | Status | Code               |
|----------------------|--------|--------------------|
| Astrologer not found | 404    | ASTROLOGER_NOT_FOUND |

---

### 3. Get My Astrologer Profile

**GET** `/api/v1/astrologers/me`

**Auth Required:** Yes (role: astrologer)

Same shape as GET /:id but includes private fields (earnings, bank details status).

---

### 4. Update My Astrologer Profile

**PATCH** `/api/v1/astrologers/me`

**Auth Required:** Yes (role: astrologer)

**Request Body (all optional):**
```json
{
  "bio": "string (max 1000 chars)",
  "skills": ["vedic", "tarot", "numerology"],
  "languages": ["hi", "en"],
  "experience": 8,
  "chatPricePerMin": 1500,
  "callPricePerMin": 2000,
  "videoPricePerMin": 2500
}
```

**Business Rules:**
- Skills must be from approved enum list
- Prices must be between 100 and 50000 paise per minute
- Only admin can approve astrologer profile (isVerified flag)

**Error Cases:**
| Condition         | Status | Code              |
|-------------------|--------|-------------------|
| Invalid skill     | 422    | VALIDATION_ERROR  |
| Price out of range| 422    | VALIDATION_ERROR  |

---

### 5. Toggle Availability

**PATCH** `/api/v1/astrologers/me/availability`

**Auth Required:** Yes (role: astrologer)

**Request Body:**
```json
{
  "isAvailable": true
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Availability updated",
  "data": { "isAvailable": true }
}
```

**Business Rules:**
- Updates Redis key `astrologer:availability:{id}` with TTL of 90 seconds
- Socket.io broadcasts availability change to all connected clients
- Astrologer must keep sending heartbeat (every 60s) to stay available
- No heartbeat for 90s → auto marked unavailable

---

### 6. Get Earnings Summary

**GET** `/api/v1/astrologers/me/earnings`

**Auth Required:** Yes (role: astrologer)

**Query Params:** `from` (date), `to` (date), `period` (day|week|month)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Earnings fetched",
  "data": {
    "totalEarnings": 250000,
    "platformFee": 75000,
    "netEarnings": 175000,
    "totalSessions": 42,
    "totalMinutes": 380,
    "breakdown": [
      { "date": "2024-01-01", "earnings": 15000, "sessions": 3 }
    ]
  }
}
```

**Business Rules:**
- Platform takes 30% of each session fee
- Astrologer receives 70%
- Amounts stored and returned in paise

---

## DB Schema

### Table: `astrologer_profiles`
```
id              UUID        PK FK → users.id
bio             TEXT
skills          TEXT[]      -- array of skill enums
languages       TEXT[]
experience      INTEGER     -- years
chatPricePerMin INTEGER     -- paise
callPricePerMin INTEGER     -- paise
videoPricePerMin INTEGER    -- paise
rating          DECIMAL(3,2) default 0
totalReviews    INTEGER     default 0
totalSessions   INTEGER     default 0
totalEarnings   INTEGER     default 0  -- paise (gross)
isVerified      BOOLEAN     default false
isOnline        BOOLEAN     default false
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### Approved Skills Enum
```
vedic, western, tarot, numerology, palmistry, vastu,
face_reading, kundli, prashna, nadi, angel_cards
```

---

## Zod Schemas

```js
export const updateAstrologerSchema = z.object({
  body: z.object({
    bio: z.string().max(1000).optional(),
    skills: z.array(z.enum([
      'vedic','western','tarot','numerology','palmistry',
      'vastu','face_reading','kundli','prashna','nadi','angel_cards'
    ])).min(1).max(5).optional(),
    languages: z.array(z.enum(['en','hi','ta','te','bn'])).optional(),
    experience: z.number().int().min(0).max(60).optional(),
    chatPricePerMin: z.number().int().min(100).max(50000).optional(),
    callPricePerMin: z.number().int().min(100).max(50000).optional(),
    videoPricePerMin: z.number().int().min(100).max(50000).optional(),
  })
});

export const astrologerListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    search: z.string().optional(),
    skills: z.string().transform(s => s.split(',')).optional(),
    language: z.string().transform(s => s.split(',')).optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
    maxPrice: z.coerce.number().optional(),
    available: z.coerce.boolean().optional(),
    sortBy: z.enum(['rating','price','experience','sessions']).default('rating'),
    sortOrder: z.enum(['asc','desc']).default('desc'),
  })
});
```
