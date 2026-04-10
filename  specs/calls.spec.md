# Spec: Calls Module

## Overview
Voice and video call signaling between user and astrologer during an ACTIVE session.
Uses WebRTC peer-to-peer connection with Socket.io as the signaling server.
AstroTalk backend acts as signaling relay only — actual media streams go peer-to-peer.

---

## How WebRTC Signaling Works (Context)

```
User (Caller)                Server (Relay)           Astrologer (Callee)
     |                            |                           |
     |── call:offer ─────────────>|── call:offer ────────────>|
     |                            |                           |
     |<─────────────────── call:answer ──────────────────────|
     |                            |                           |
     |── call:ice-candidate ─────>|── call:ice-candidate ────>|
     |<───────────── call:ice-candidate ─────────────────────|
     |                            |                           |
     |════════ Direct P2P media stream (no server) ══════════|
     |                            |                           |
     |── call:end ───────────────>|── call:end ──────────────>|
```

Server only relays signaling messages. It never touches media.

---

## Call State Machine

```
IDLE
  → RINGING   (offer sent, waiting for answer)
  → ACTIVE    (answer received, ICE complete, call connected)
  → ENDED     (call:end received from either party)
  → FAILED    (ICE failure, timeout, or error)
```

Call state is stored in Redis (not DB) — it is ephemeral.
Redis key: `call:state:{sessionId}` with TTL of 1 hour.

---

## Socket.io Events

All call events require the socket to already be authenticated and joined to the session room via `chat:join`.

---

### Client → Server Events

#### `call:offer`
Caller sends WebRTC offer SDP to start a call.

**Payload:**
```json
{
  "sessionId": "uuid",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- 46117..."
  }
}
```

**Business Rules:**
- Session must be ACTIVE
- Session type must be `call` or `video`
- Caller must be the user (not astrologer)
- Set call state in Redis: `RINGING`
- Relay offer to astrologer in the room
- If no answer within 60 seconds → emit `call:timeout` → set state `FAILED`

**Relayed to astrologer:**
```json
{
  "sessionId": "uuid",
  "callerId": "uuid",
  "sdp": { "type": "offer", "sdp": "..." }
}
```

**Error ack:**
```json
{ "success": false, "code": "SESSION_NOT_ACTIVE" }
{ "success": false, "code": "INVALID_SESSION_TYPE" }
{ "success": false, "code": "CALL_ALREADY_IN_PROGRESS" }
```

---

#### `call:answer`
Callee (astrologer) responds with WebRTC answer SDP.

**Payload:**
```json
{
  "sessionId": "uuid",
  "sdp": {
    "type": "answer",
    "sdp": "v=0\r\no=- 12345..."
  }
}
```

**Business Rules:**
- Call state must be `RINGING`
- Only the astrologer can answer
- Set call state in Redis: `ACTIVE`
- Clear the 60-second timeout
- Relay answer to user in the room

**Relayed to user:**
```json
{
  "sessionId": "uuid",
  "sdp": { "type": "answer", "sdp": "..." }
}
```

---

#### `call:ice-candidate`
Either party sends an ICE candidate for NAT traversal.

**Payload:**
```json
{
  "sessionId": "uuid",
  "candidate": {
    "candidate": "candidate:1 1 UDP ...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

**Business Rules:**
- Relay immediately to the other participant in the room
- No persistence, no state change
- Silently ignore if call state is not RINGING or ACTIVE

**Relayed to other party:**
```json
{
  "sessionId": "uuid",
  "senderId": "uuid",
  "candidate": { ... }
}
```

---

#### `call:end`
Either party ends the call.

**Payload:**
```json
{
  "sessionId": "uuid",
  "reason": "user_ended | astrologer_ended | timeout | connection_failed"
}
```

**Business Rules:**
- Set call state in Redis: `ENDED`
- Relay `call:ended` to all participants in room
- Trigger session end flow (same as PATCH /sessions/:id/end)
- Log call duration from Redis RINGING → ACTIVE → ENDED timestamps

**Relayed to room:**
```json
{
  "sessionId": "uuid",
  "endedBy": "uuid",
  "reason": "user_ended",
  "duration": 720
}
```

---

#### `call:reject`
Astrologer rejects the incoming call.

**Payload:**
```json
{ "sessionId": "uuid" }
```

**Business Rules:**
- Call state must be `RINGING`
- Set call state: `ENDED`
- Relay `call:rejected` to user
- Cancel the session (status: CANCELLED, reason: "call_rejected")

---

#### `call:media-toggle`
Either party toggles their audio or video.

**Payload:**
```json
{
  "sessionId": "uuid",
  "audio": true,
  "video": false
}
```

**Business Rules:**
- Do NOT persist to DB — relay only
- Relay to the other participant so UI can show mute/camera-off indicators

**Relayed to other party:**
```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "audio": true,
  "video": false
}
```

---

### Server → Client Events

| Event                  | When                                        | Payload                                |
|------------------------|---------------------------------------------|----------------------------------------|
| `call:offer`           | Relayed from caller                         | { sessionId, callerId, sdp }           |
| `call:answer`          | Relayed from callee                         | { sessionId, sdp }                     |
| `call:ice-candidate`   | Relayed ICE candidate                       | { sessionId, senderId, candidate }     |
| `call:ended`           | Call ended by either party                  | { sessionId, endedBy, reason, duration }|
| `call:rejected`        | Astrologer rejected call                    | { sessionId }                          |
| `call:timeout`         | No answer within 60 seconds                 | { sessionId }                          |
| `call:media-toggle`    | Other party toggled audio/video             | { sessionId, userId, audio, video }    |
| `call:reconnecting`    | ICE connection dropped, attempting reconnect| { sessionId }                          |

---

## REST Endpoints

### 1. Get Call Log

**GET** `/api/v1/calls/:sessionId`

**Auth Required:** Yes (participant of the session)

**Success Response — 200**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "type": "call",
    "startedAt": "2024-01-01T10:00:00Z",
    "connectedAt": "2024-01-01T10:00:08Z",
    "endedAt": "2024-01-01T10:12:00Z",
    "durationSeconds": 712,
    "endReason": "user_ended"
  }
}
```

---

## Redis State Schema

```
Key:   call:state:{sessionId}
Type:  Hash
TTL:   3600 (1 hour)

Fields:
  state         RINGING | ACTIVE | ENDED | FAILED
  callerId      uuid
  calleeId      uuid
  offeredAt     ISO8601
  answeredAt    ISO8601 (null until answered)
  endedAt       ISO8601 (null until ended)
  endReason     string
```

---

## DB Schema (call_logs table)

```
id              UUID        PK
sessionId       UUID        FK → sessions.id UNIQUE
offeredAt       TIMESTAMP
answeredAt      TIMESTAMP   nullable
endedAt         TIMESTAMP   nullable
durationSeconds INTEGER     nullable
endReason       VARCHAR(50)
createdAt       TIMESTAMP   default now()
```

Written at call end from Redis state.

---

## STUN/TURN Configuration

```js
// Sent to client on session start or on call:join
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls:       process.env.TURN_SERVER_URL,
    username:   process.env.TURN_USERNAME,
    credential: process.env.TURN_CREDENTIAL,
  }
];
```

Environment variables:
```env
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=astrotalk
TURN_CREDENTIAL=secret
```

---

## File Structure

```
src/socket/handlers/
├── chat.handler.js
└── call.handler.js     ← all call: events

src/modules/calls/
├── calls.routes.js
├── calls.controller.js
├── calls.service.js
├── calls.repository.js
└── calls.test.js
```

---

## Test Cases

| #  | Scenario                                      | Expected                                      |
|----|-----------------------------------------------|-----------------------------------------------|
| 1  | call:offer from user on active call session   | Relayed to astrologer, state → RINGING        |
| 2  | call:offer on non-call session type           | Ack error INVALID_SESSION_TYPE                |
| 3  | call:answer from astrologer                   | Relayed to user, state → ACTIVE               |
| 4  | call:answer from user (wrong party)           | Ack error FORBIDDEN                           |
| 5  | No answer within 60s                          | call:timeout emitted, state → FAILED          |
| 6  | call:ice-candidate relayed to other party     | No DB write, relayed immediately              |
| 7  | call:end from user                            | state → ENDED, session ended, log written     |
| 8  | call:reject from astrologer                   | state → ENDED, session CANCELLED              |
| 9  | call:media-toggle not persisted               | Relayed only, no DB write                     |
| 10 | GET /calls/:sessionId — participant only      | Returns call log with duration                |
