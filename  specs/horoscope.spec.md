# Spec: Horoscope Module

## Overview
Provides daily, weekly, and monthly horoscope content per zodiac sign.
Content is either fetched from an external API or managed by admins.
Responses are aggressively cached in Redis to avoid repeated DB/API calls.

---

## Zodiac Signs
```
aries, taurus, gemini, cancer, leo, virgo,
libra, scorpio, sagittarius, capricorn, aquarius, pisces
```

---

## Endpoints

### 1. Get Daily Horoscope

**GET** `/api/v1/horoscope/daily/:sign`

**Auth Required:** No

**Path Params:**
- `sign` — zodiac sign (enum above)

**Query Params:**
- `date` — YYYY-MM-DD (default: today in IST)

**Success Response — 200**
```json
{
  "success": true,
  "message": "Horoscope fetched",
  "data": {
    "sign": "aries",
    "date": "2024-01-15",
    "period": "daily",
    "prediction": "Today is a great day to take bold decisions...",
    "luckyNumber": 7,
    "luckyColor": "Red",
    "luckyTime": "6:00 AM - 8:00 AM",
    "compatibility": "leo",
    "mood": "energetic",
    "rating": {
      "overall": 4,
      "love": 3,
      "career": 5,
      "health": 4,
      "finance": 3
    }
  }
}
```

**Business Rules:**
- Cache in Redis: key `horoscope:daily:{sign}:{date}` with TTL until end of day (IST)
- If not in cache → fetch from DB → if not in DB → generate via external API → store in DB → cache
- Date defaults to today in IST (UTC+5:30)
- Invalid sign → 422 VALIDATION_ERROR

---

### 2. Get Weekly Horoscope

**GET** `/api/v1/horoscope/weekly/:sign`

**Auth Required:** No

**Query Params:**
- `week` — ISO week string e.g. `2024-W03` (default: current week)

**Success Response — 200**
```json
{
  "success": true,
  "data": {
    "sign": "aries",
    "week": "2024-W03",
    "period": "weekly",
    "prediction": "This week brings opportunities for career growth...",
    "highlights": [
      { "day": "Monday", "summary": "Focus on communication" },
      { "day": "Wednesday", "summary": "Financial decisions favoured" }
    ],
    "rating": {
      "overall": 4,
      "love": 3,
      "career": 5,
      "health": 4,
      "finance": 3
    }
  }
}
```

**Business Rules:**
- Cache key: `horoscope:weekly:{sign}:{week}` with TTL until end of week (Sunday IST)

---

### 3. Get Monthly Horoscope

**GET** `/api/v1/horoscope/monthly/:sign`

**Auth Required:** No

**Query Params:**
- `month` — YYYY-MM format (default: current month)

**Success Response — 200**
```json
{
  "success": true,
  "data": {
    "sign": "aries",
    "month": "2024-01",
    "period": "monthly",
    "prediction": "January 2024 is a transformative month for Aries...",
    "rating": {
      "overall": 4,
      "love": 3,
      "career": 5,
      "health": 4,
      "finance": 3
    }
  }
}
```

**Business Rules:**
- Cache key: `horoscope:monthly:{sign}:{month}` with TTL until end of month (IST)

---

### 4. Get Today's Horoscope for Logged-in User

**GET** `/api/v1/horoscope/me`

**Auth Required:** Yes (role: user)

**Business Rules:**
- Read user's zodiacSign from their profile
- If zodiacSign is null (profile incomplete) → 422 ZODIAC_NOT_SET
- Return today's daily horoscope for that sign

**Error Cases:**
| Condition           | Status | Code             |
|---------------------|--------|------------------|
| zodiacSign not set  | 422    | ZODIAC_NOT_SET   |

---

### 5. Admin — Create/Update Horoscope Content

**PUT** `/api/v1/admin/horoscope`

**Auth Required:** Yes (role: admin)

**Request Body:**
```json
{
  "sign": "aries",
  "period": "daily",
  "date": "2024-01-15",
  "prediction": "Today is a great day...",
  "luckyNumber": 7,
  "luckyColor": "Red",
  "luckyTime": "6:00 AM - 8:00 AM",
  "compatibility": "leo",
  "mood": "energetic",
  "rating": {
    "overall": 4,
    "love": 3,
    "career": 5,
    "health": 4,
    "finance": 3
  }
}
```

**Business Rules:**
- Upsert by (sign + period + date/week/month)
- Invalidate Redis cache for this sign+period+date on save

---

## DB Schema

### Table: `horoscopes`
```
id            UUID        PK
sign          ENUM        (aries, taurus, ...)
period        ENUM        (daily, weekly, monthly)
dateKey       VARCHAR(20) -- '2024-01-15' | '2024-W03' | '2024-01'
prediction    TEXT        NOT NULL
luckyNumber   SMALLINT
luckyColor    VARCHAR(50)
luckyTime     VARCHAR(50)
compatibility VARCHAR(20)
mood          VARCHAR(50)
overallRating SMALLINT    CHECK (1-5)
loveRating    SMALLINT    CHECK (1-5)
careerRating  SMALLINT    CHECK (1-5)
healthRating  SMALLINT    CHECK (1-5)
financeRating SMALLINT    CHECK (1-5)
createdAt     TIMESTAMP
updatedAt     TIMESTAMP

UNIQUE (sign, period, dateKey)
```

---

## Caching Strategy

```
Request for horoscope
  ↓
Redis cache hit? → return immediately (TTL: rest of day/week/month)
  ↓ miss
DB record exists? → store in Redis → return
  ↓ miss
External API call (or generate) → store in DB → store in Redis → return
```

Redis TTL calculation:
```js
const getTTL = (period, date) => {
  const now = toIST(new Date());
  if (period === 'daily')   return secondsUntilEndOfDay(now);
  if (period === 'weekly')  return secondsUntilEndOfWeek(now);
  if (period === 'monthly') return secondsUntilEndOfMonth(now);
};
```

---

## Zod Schemas

```js
const ZODIAC_SIGNS = [
  'aries','taurus','gemini','cancer','leo','virgo',
  'libra','scorpio','sagittarius','capricorn','aquarius','pisces'
];

export const horoscopeParamSchema = z.object({
  params: z.object({
    sign: z.enum(ZODIAC_SIGNS),
  }),
  query: z.object({
    date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    week:  z.string().regex(/^\d{4}-W\d{2}$/).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  })
});
```

---

## File Structure

```
src/modules/horoscope/
├── horoscope.routes.js
├── horoscope.controller.js
├── horoscope.service.js
├── horoscope.repository.js
├── horoscope.schema.js
└── horoscope.test.js
```

---

## Test Cases

| #  | Scenario                                   | Expected                                    |
|----|--------------------------------------------|---------------------------------------------|
| 1  | GET daily horoscope — cache miss           | Fetched from DB, stored in Redis, returned  |
| 2  | GET daily horoscope — cache hit            | Returned from Redis, no DB query            |
| 3  | GET daily horoscope — invalid sign         | 422 VALIDATION_ERROR                        |
| 4  | GET /horoscope/me — zodiac set             | Returns today's horoscope for user's sign   |
| 5  | GET /horoscope/me — zodiac not set         | 422 ZODIAC_NOT_SET                          |
| 6  | Admin PUT — creates new record             | DB upserted, Redis cache invalidated        |
| 7  | Admin PUT — non-admin user                 | 403 FORBIDDEN                               |
| 8  | Redis TTL daily — set correctly            | TTL = seconds until midnight IST            |
