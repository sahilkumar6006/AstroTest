# Spec: Socket.io Infrastructure

## Overview
Defines how the Socket.io server is initialized, attached to the HTTP server,
and shared across modules (chat, calls, astrologer availability, sessions).

This spec covers infrastructure only — event payloads and business rules for
individual features are defined in their own specs:
- Chat events → `chat.spec.md`
- Call signaling → `calls.spec.md`
- Session events (requested, accepted, ended) → `sessions-payments-reviews.spec.md`
- Astrologer availability broadcasts → `astrologers.spec.md`

---

## Architecture

```
server.ts
  └── createServer(app)
        └── initSocket(httpServer)       ← single call at startup
              ├── io.use(socketAuth)     ← JWT auth for every connection
              └── io.on('connection', registerHandlers)
                    ├── registerChatHandlers(io, socket)
                    ├── registerCallHandlers(io, socket)
                    └── registerSessionHandlers(io, socket)
```

Socket.io is attached to the same HTTP server as Express. There is a single
default namespace (`/`). No separate namespaces per feature.

---

## File Structure

```
src/socket/
├── index.ts                  ← exports initSocket(server) and getIO()
├── middleware/
│   └── socket.auth.ts        ← JWT validation on connect
└── handlers/
    ├── chat.handler.ts        ← registers chat: events
    ├── call.handler.ts        ← registers call: events
    └── session.handler.ts     ← registers session: events (accept/reject)
```

`initSocket` is called once from `server.ts`. All other files that need to
emit events call `getIO()` to get the singleton instance.

---

## Initialization

### `src/socket/index.ts`

```ts
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { socketAuth } from './middleware/socket.auth.js';
import { registerChatHandlers } from './handlers/chat.handler.js';
import { registerCallHandlers } from './handlers/call.handler.js';
import { registerSessionHandlers } from './handlers/session.handler.js';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin:      appConfig.corsOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout:  20000,
    pingInterval: 25000,
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.data.user.sub}`);

    registerChatHandlers(io, socket);
    registerCallHandlers(io, socket);
    registerSessionHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} reason: ${reason}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new AppError('Socket.io not initialized', 500, 'INTERNAL_ERROR');
  return io;
};
```

### `src/server.ts` (updated wiring)

```ts
const httpServer = createServer(app);
initSocket(httpServer);
httpServer.listen(appConfig.port, () => {
  logger.info(`Server running on port ${appConfig.port}`);
});
```

---

## Authentication Middleware

### `src/socket/middleware/socket.auth.ts`

Runs on every new connection before the `connection` event fires.

```ts
io.use(async (socket, next) => {
  const raw = socket.handshake.auth?.token as string | undefined;
  const token = raw?.replace('Bearer ', '');

  if (!token) return next(new Error('UNAUTHORIZED'));

  try {
    const payload = verifyAccessToken(token);   // from src/utils/jwt.ts
    socket.data.user = payload;                 // { sub: userId, role, phone }
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
});
```

- Uses the same `verifyAccessToken` utility as the HTTP `authenticate` middleware
- On failure, the client receives a `connect_error` event with message `UNAUTHORIZED`
- `socket.data.user` is typed as `JwtPayload` (no `any`)

**Client connection example:**
```ts
const socket = io('http://localhost:3000', {
  auth: { token: `Bearer ${accessToken}` },
  transports: ['websocket'],
});
```

---

## Room Naming Conventions

| Purpose                  | Room name                  | Who joins                         |
|--------------------------|----------------------------|-----------------------------------|
| Session chat/calls       | `session:{sessionId}`      | Both user and astrologer          |
| User personal room       | `user:{userId}`            | Only that user (auto-joined)      |
| Astrologer personal room | `user:{userId}`            | Only that astrologer (same pattern)|

**Personal room:** Every authenticated socket automatically joins `user:{userId}` on
connect. This allows server-side services to emit to a specific user without
knowing their socket ID.

```ts
// Auto-join personal room in the connection handler
io.on('connection', (socket) => {
  socket.join(`user:${socket.data.user.sub}`);
  ...
});
```

---

## Emitting from Services (outside socket handlers)

Other modules (sessions, notifications) need to emit events without access to
a specific socket. They use `getIO()` and target rooms.

```ts
// sessions.service.ts — notify astrologer of new session request
import { getIO } from '../../socket/index.js';

getIO().to(`user:${astrologerId}`).emit('session:requested', {
  sessionId,
  userId,
  userName,
  type,
  pricePerMin,
});
```

**Rule:** Never import `getIO` from within socket handler files. Only service
files in `src/modules/` should call `getIO()` for outbound emissions.

---

## Server → Client Events (Global)

These events are emitted from services directly to personal rooms, not within session rooms.

| Event                    | Room target          | Emitted by             | Payload                                              |
|--------------------------|----------------------|------------------------|------------------------------------------------------|
| `session:requested`      | `user:{astroId}`     | sessions.service       | `{ sessionId, userId, userName, type, pricePerMin }` |
| `session:accepted`       | `user:{userId}`      | sessions.service       | `{ sessionId, astrologerId }`                        |
| `session:cancelled`      | both personal rooms  | sessions.service       | `{ sessionId, reason }`                              |
| `session:ended`          | `session:{id}` room  | sessions.service       | `{ sessionId, durationMinutes, totalCost }`          |
| `session:wallet-warning` | `user:{userId}`      | sessions.service       | `{ sessionId, walletBalancePaise, minutesLeft }`     |
| `astrologer:availability`| broadcast to all     | astrologers.service    | `{ astrologerId, isAvailable }`                      |

---

## Socket Event Ack Pattern

All client → server events that expect a response use Socket.io acknowledgements.
Handler functions follow this pattern:

```ts
socket.on('chat:join', async (payload, ack) => {
  try {
    // validate and process
    ack({ success: true });
  } catch (err) {
    if (err instanceof AppError) {
      ack({ success: false, code: err.code, message: err.message });
    } else {
      logger.error('socket chat:join error', err);
      ack({ success: false, code: 'INTERNAL_ERROR', message: 'Unexpected error' });
    }
  }
});
```

- All acks return `{ success: boolean, ...payload }` or `{ success: false, code, message }`
- Never call `socket.emit('error', ...)` for business errors — use ack
- Reserve the `error` event for infrastructure-level failures only

---

## Handler Registration Pattern

Each handler file exports a single `register*Handlers` function:

```ts
// src/socket/handlers/chat.handler.ts
import type { Server, Socket } from 'socket.io';

export const registerChatHandlers = (io: Server, socket: Socket): void => {
  socket.on('chat:join',    (payload, ack) => handleChatJoin(io, socket, payload, ack));
  socket.on('chat:message', (payload, ack) => handleChatMessage(io, socket, payload, ack));
  socket.on('chat:read',    (payload, ack) => handleChatRead(io, socket, payload, ack));
  socket.on('chat:typing',  (payload)      => handleChatTyping(io, socket, payload));
};
```

- Handlers call service functions from the relevant module (e.g., `chatService`, `callService`)
- No business logic inside handler files — delegate to services
- Handlers do NOT import repositories directly

---

## TypeScript Types

```ts
// src/socket/types.ts

export interface SocketUser {
  sub:   string;   // userId
  role:  'user' | 'astrologer' | 'admin';
  phone: string;
}

// Extend Socket.io's Socket type
declare module 'socket.io' {
  interface SocketData {
    user: SocketUser;
  }
}
```

This gives `socket.data.user` full type safety across all handler files.

---

## Error Codes (Socket-level)

| Code               | When                                                  |
|--------------------|-------------------------------------------------------|
| `UNAUTHORIZED`     | Missing or invalid JWT on connect (connect_error)     |
| `INTERNAL_ERROR`   | Unexpected server error in a handler                  |

Feature-level error codes (SESSION_NOT_FOUND, FORBIDDEN, etc.) are defined in
each feature's spec and returned in ack payloads.

---

## Environment Variables

No new env vars required. Uses existing:
```env
JWT_ACCESS_SECRET=      # same as HTTP auth
CORS_ORIGIN=            # already in app.config.ts
```

---

## Test Cases

| #  | Scenario                                            | Expected                                          |
|----|-----------------------------------------------------|---------------------------------------------------|
| 1  | Connect with valid Bearer token                     | Connected; socket.data.user populated             |
| 2  | Connect with no token                               | connect_error: UNAUTHORIZED                       |
| 3  | Connect with expired token                          | connect_error: UNAUTHORIZED                       |
| 4  | Connect with valid token — auto-joins personal room | socket in room `user:{userId}`                    |
| 5  | Service calls getIO() before initSocket             | Throws AppError INTERNAL_ERROR                    |
| 6  | getIO().to(room).emit from service layer            | Event received by all sockets in that room        |
| 7  | Handler throws AppError                             | Ack returns { success: false, code, message }     |
| 8  | Handler throws unknown error                        | Ack returns INTERNAL_ERROR, error logged          |
| 9  | Socket disconnects mid-session                      | disconnect logged; no crash; partner not affected |
