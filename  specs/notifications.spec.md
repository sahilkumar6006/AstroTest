# Spec: Notifications Module

## Overview
Handles push notifications (FCM) and in-app notifications for users and astrologers.
Notifications are triggered by system events — session requests, messages, payments, etc.
Users can manage notification preferences and view notification history.

---

## Notification Types

```
SESSION_REQUESTED       → astrologer: user wants a session
SESSION_ACCEPTED        → user: astrologer accepted session
SESSION_REJECTED        → user: astrologer rejected session
SESSION_ENDED           → both: session has ended
SESSION_REMINDER        → user: low wallet balance during session
PAYMENT_SUCCESS         → user: wallet credited
PAYMENT_FAILED          → user: payment failed
NEW_MESSAGE             → both: new chat message received
CALL_INCOMING           → astrologer: incoming call
CALL_MISSED             → user: astrologer missed the call
REVIEW_REMINDER         → user: reminder to review completed session
ASTROLOGER_ONLINE       → user: favourite astrologer came online
PROFILE_APPROVED        → astrologer: profile verified by admin
PROMO                   → all: promotional or marketing notification
```

---

## REST Endpoints

### 1. Register Device Token

**POST** `/api/v1/notifications/device-token`

**Auth Required:** Yes (any role)

**Request Body:**
```json
{
  "token": "FCM_device_token_string",
  "platform": "android | ios | web"
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Device token registered",
  "data": null
}
```

**Business Rules:**
- Upsert device token for user — a user can have multiple devices
- Store platform alongside token
- One user can have max 5 active device tokens (remove oldest on overflow)
- Token is associated with userId — deactivated on logout

---

### 2. Get Notification List

**GET** `/api/v1/notifications`

**Auth Required:** Yes (any role)

**Query Params:**
- `page`, `limit` (default 20)
- `read` — `true | false | all` (default: all)

**Success Response — 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "SESSION_REQUESTED",
      "title": "New Session Request",
      "body": "Rahul S. wants a chat session",
      "data": { "sessionId": "uuid" },
      "isRead": false,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

### 3. Mark Notifications as Read

**PATCH** `/api/v1/notifications/read`

**Auth Required:** Yes (any role)

**Request Body:**
```json
{
  "notificationIds": ["uuid", "uuid"],
  "markAll": false
}
```

If `markAll: true` → mark all unread notifications for this user as read (ignores notificationIds).

**Success Response — 200**
```json
{
  "success": true,
  "message": "Notifications marked as read",
  "data": { "updated": 3 }
}
```

---

### 4. Get Unread Count

**GET** `/api/v1/notifications/unread-count`

**Auth Required:** Yes (any role)

**Success Response — 200**
```json
{
  "success": true,
  "data": { "count": 7 }
}
```

---

### 5. Update Notification Preferences

**PATCH** `/api/v1/notifications/preferences`

**Auth Required:** Yes (any role)

**Request Body:**
```json
{
  "sessionRequests": true,
  "messages":        true,
  "payments":        true,
  "promotions":      false,
  "astrologerOnline": true
}
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Preferences updated",
  "data": { ...updatedPreferences }
}
```

---

### 6. Delete Device Token (on logout)

**DELETE** `/api/v1/notifications/device-token`

**Auth Required:** Yes (any role)

**Request Body:**
```json
{ "token": "FCM_device_token_string" }
```

Called automatically by the auth module on logout.

---

## Internal Notification Service

Used by other modules to trigger notifications — never called directly from routes.

```js
// src/modules/notifications/notifications.service.js

/**
 * Send a notification to one or more users.
 * Saves to DB + sends FCM push if device tokens exist.
 *
 * @param {object} options
 * @param {string|string[]} options.userIds    - recipient user ID(s)
 * @param {string}          options.type       - NotificationType enum
 * @param {string}          options.title      - Push notification title
 * @param {string}          options.body       - Push notification body
 * @param {object}          options.data       - Extra data payload (sessionId, etc.)
 */
export const sendNotification = async ({ userIds, type, title, body, data }) => { ... };
```

### Usage examples from other modules

```js
// sessions.service.js — when session is requested
await notificationService.sendNotification({
  userIds: [astrologerId],
  type:    'SESSION_REQUESTED',
  title:   'New Session Request',
  body:    `${userName} wants a ${sessionType} session`,
  data:    { sessionId },
});

// payments.service.js — when wallet is credited
await notificationService.sendNotification({
  userIds: [userId],
  type:    'PAYMENT_SUCCESS',
  title:   'Wallet Credited',
  body:    `₹${amount / 100} has been added to your wallet`,
  data:    { amount, orderId },
});
```

---

## FCM Integration

```js
// src/config/firebase.js
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

export const messaging = admin.messaging();
```

```js
// Send to multiple device tokens
const sendFCM = async (tokens, { title, body, data }) => {
  if (!tokens.length) return;
  const message = {
    notification: { title, body },
    data:         { ...data, type: data.type ?? '' }, // FCM data must be strings
    tokens,
  };
  const response = await messaging.sendEachForMulticast(message);
  // Remove invalid tokens from DB
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
      deviceTokenRepository.deleteToken(tokens[i]);
    }
  });
};
```

---

## DB Schema

### Table: `notifications`
```
id          UUID        PK
userId      UUID        FK → users.id
type        VARCHAR(50) NOT NULL
title       VARCHAR(255)
body        TEXT
data        JSONB       default '{}'
isRead      BOOLEAN     default false
createdAt   TIMESTAMP   default now()
```

**Index:**
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
```

### Table: `device_tokens`
```
id          UUID        PK
userId      UUID        FK → users.id
token       TEXT        NOT NULL UNIQUE
platform    ENUM        (android, ios, web)
createdAt   TIMESTAMP   default now()

UNIQUE (userId, token)
```

### Table: `notification_preferences`
```
id                UUID      PK FK → users.id
sessionRequests   BOOLEAN   default true
messages          BOOLEAN   default true
payments          BOOLEAN   default true
promotions        BOOLEAN   default true
astrologerOnline  BOOLEAN   default true
updatedAt         TIMESTAMP
```

---

## Environment Variables

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## File Structure

```
src/modules/notifications/
├── notifications.routes.js
├── notifications.controller.js
├── notifications.service.js      ← also used internally by other modules
├── notifications.repository.js
├── notifications.schema.js
└── notifications.test.js

src/config/
└── firebase.js
```

---

## Test Cases

| #  | Scenario                                         | Expected                                   |
|----|--------------------------------------------------|--------------------------------------------|
| 1  | Register device token — new token                | Token saved in DB                          |
| 2  | Register device token — duplicate token          | Upserted (no duplicate)                    |
| 3  | Register 6th device — oldest removed             | Max 5 tokens enforced                      |
| 4  | GET notifications — paginated, filtered by read  | Correct results returned                   |
| 5  | PATCH read — specific IDs                        | Only those notifications marked read       |
| 6  | PATCH read — markAll: true                       | All unread for user marked read            |
| 7  | GET unread-count                                 | Correct integer returned                   |
| 8  | sendNotification — user has tokens               | FCM called, notification saved to DB       |
| 9  | sendNotification — user has no tokens            | Notification saved to DB, FCM not called   |
| 10 | FCM invalid token → auto-deleted from DB         | Token removed from device_tokens           |
| 11 | DELETE device token on logout                    | Token removed from DB                      |
| 12 | Preference: promotions: false                    | PROMO notifications not sent via FCM       |
