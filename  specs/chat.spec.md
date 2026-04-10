# Spec: Chat Module

## Overview
Real-time chat between a user and an astrologer during an ACTIVE session.
Messages are delivered via Socket.io and persisted to PostgreSQL.
Chat history is paginated and loadable via REST.

---

## Architecture

```
User connects Socket.io
  → authenticates via accessToken in handshake
  → joins room: session:{sessionId}
  → sends message event
  → server saves to DB
  → server broadcasts to both participants in room
  → other party receives message event
```

---

## REST Endpoints

### 1. Get Chat History

**GET** `/api/v1/chat/:sessionId/messages`

**Auth Required:** Yes (user or astrologer of that session)

**Query Params:**
```
page    integer  default 1
limit   integer  default 50, max 100
before  string   ISO8601 cursor — messages before this timestamp (for infinite scroll)
```

**Success Response — 200**
```json
{
  "success": true,
  "message": "Messages fetched",
  "data": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "senderId": "uuid",
      "senderRole": "user",
      "type": "text",
      "content": "Hello, I have a question about my kundli",
      "readAt": null,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 24, "totalPages": 1 }
}
```

**Business Rules:**
- Only participants of the session can fetch messages
- Messages returned in ascending createdAt order
- Session must not be in PENDING or FAILED status

**Error Cases:**
| Condition              | Status | Code                  |
|------------------------|--------|-----------------------|
| Session not found      | 404    | SESSION_NOT_FOUND     |
| Not a participant      | 403    | FORBIDDEN             |

---

## Socket.io Events

### Connection & Authentication

```js
// Client connects with token in handshake auth
const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer eyJhbGci...' }
});
```

Server validates token on connection. Invalid token → disconnect with error `UNAUTHORIZED`.

---

### Client → Server Events

#### `chat:join`
Join a session room. Must be called after connect before sending messages.

**Payload:**
```json
{ "sessionId": "uuid" }
```

**Server Response (ack):**
```json
{ "success": true, "message": "Joined session room" }
```

**Business Rules:**
- Verify session exists and user is a participant
- Verify session status is ACTIVE
- Join socket to room `session:{sessionId}`

**Error ack:**
```json
{ "success": false, "code": "SESSION_NOT_FOUND" }
{ "success": false, "code": "SESSION_NOT_ACTIVE" }
{ "success": false, "code": "FORBIDDEN" }
```

---

#### `chat:message`
Send a message in the session.

**Payload:**
```json
{
  "sessionId": "uuid",
  "type": "text",
  "content": "Hello, I need guidance about my career"
}
```

**Business Rules:**
- Validate session is ACTIVE
- Validate sender is a participant
- Message type must be `text` (image/audio support in future)
- Content max length: 2000 characters
- Save message to DB
- Emit `chat:message` to everyone in room `session:{sessionId}`
- Update `lastMessageAt` on session

**Server broadcasts to room:**
```json
{
  "id": "uuid",
  "sessionId": "uuid",
  "senderId": "uuid",
  "senderRole": "user",
  "type": "text",
  "content": "Hello, I need guidance about my career",
  "createdAt": "2024-01-01T10:00:05Z"
}
```

**Error ack:**
```json
{ "success": false, "code": "SESSION_NOT_ACTIVE" }
{ "success": false, "code": "MESSAGE_TOO_LONG" }
{ "success": false, "code": "FORBIDDEN" }
```

---

#### `chat:read`
Mark all messages in a session as read up to a given message.

**Payload:**
```json
{ "sessionId": "uuid", "messageId": "uuid" }
```

**Business Rules:**
- Update `readAt` on all messages in session sent by the other party up to this messageId
- Emit `chat:read` to the room so the sender sees read receipts

**Server broadcasts to room:**
```json
{
  "sessionId": "uuid",
  "readBy": "uuid",
  "readUpTo": "uuid",
  "readAt": "2024-01-01T10:00:10Z"
}
```

---

#### `chat:typing`
Notify the other participant that this user is typing.

**Payload:**
```json
{ "sessionId": "uuid", "isTyping": true }
```

**Business Rules:**
- Do NOT persist to DB — broadcast only
- Broadcast `chat:typing` to room excluding sender

**Server broadcasts to room (excluding sender):**
```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "isTyping": true
}
```

---

### Server → Client Events

| Event            | When                                          | Payload                             |
|------------------|-----------------------------------------------|-------------------------------------|
| `chat:message`   | New message in session                        | Full message object                 |
| `chat:read`      | Other party read messages                     | { sessionId, readBy, readUpTo, readAt } |
| `chat:typing`    | Other party typing status changed             | { sessionId, userId, isTyping }     |
| `session:ended`  | Session ended by either party or auto         | { sessionId, reason }               |
| `error`          | Any socket error                              | { code, message }                   |

---

## DB Schema

### Table: `messages`
```
id            UUID        PK
sessionId     UUID        FK → sessions.id
senderId      UUID        FK → users.id
senderRole    ENUM        (user, astrologer)
type          ENUM        (text)       -- image, audio added later
content       TEXT        NOT NULL max 2000 chars
readAt        TIMESTAMP   nullable
createdAt     TIMESTAMP   default now()
```

**Indexes:**
```sql
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

---

## Socket.io Server Setup

```
src/socket/
├── index.js            ← initialize Socket.io on HTTP server
├── middleware/
│   └── socketAuth.js   ← validate JWT on connection
└── handlers/
    └── chat.handler.js ← all chat: events
```

### socketAuth middleware
```js
// Runs on every new socket connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token?.replace('Bearer ', '');
  if (!token) return next(new Error('UNAUTHORIZED'));
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.user = payload; // { sub: userId, role }
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
});
```

---

## Zod Schemas

```js
export const chatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  type:      z.enum(['text']),
  content:   z.string().min(1).max(2000),
});

export const chatReadSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const chatHistoryQuerySchema = z.object({
  query: z.object({
    page:   z.coerce.number().int().positive().default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().datetime().optional(),
  })
});
```

---

## Test Cases

| #  | Scenario                                      | Expected                              |
|----|-----------------------------------------------|---------------------------------------|
| 1  | Connect with valid token                      | Connected, user attached to socket    |
| 2  | Connect with invalid token                    | Disconnected with UNAUTHORIZED        |
| 3  | Join active session as participant            | Joined room successfully              |
| 4  | Join session as non-participant               | Ack error FORBIDDEN                   |
| 5  | Join ended session                            | Ack error SESSION_NOT_ACTIVE          |
| 6  | Send valid text message                       | Saved to DB, broadcast to room        |
| 7  | Send message exceeding 2000 chars             | Ack error MESSAGE_TOO_LONG            |
| 8  | Send message to ended session                 | Ack error SESSION_NOT_ACTIVE          |
| 9  | typing event — not persisted                  | Broadcast to room, nothing in DB      |
| 10 | read event — updates readAt on messages       | DB updated, broadcast to room         |
| 11 | GET /chat/:sessionId/messages — paginated     | Messages in ASC order                 |
| 12 | GET messages as non-participant               | 403 FORBIDDEN                         |
