# CLAUDE.md — AstroTalk Backend

## Project Overview

AstroTalk is a backend API for a platform connecting users with astrologers for live consultations (chat, voice, and video). Built as a **spec-driven, layered Express.js + PostgreSQL service** in TypeScript.

**Primary users:** End-users booking astrologer sessions; astrologers managing availability and earnings; admins managing the platform.

**What this service optimizes for:**
- Correctness and safety over cleverness — money and sessions are involved
- Spec-first development: no module is coded without an approved spec in `specs/`
- Clear, auditable business logic separated from transport/persistence concerns
- Strict TypeScript for compile-time safety across the entire codebase

**Critical constraints:**
- All monetary values are stored and transmitted in **paise** (integer), never floats
- Phone numbers are always in **E.164 format** (`+91XXXXXXXXXX`)
- Soft-deletes only — never hard-delete user or transaction records
- UUIDs for all primary keys

Do not introduce complexity or abstractions beyond what the current spec requires.

---

## Tech Stack

- **Runtime:** Node.js 20+ (targeting Node 24 LTS)
- **Framework:** Express.js v5 (with async error propagation)
- **Language:** TypeScript 6 — strict mode, `nodenext` modules, ES2024 target
- **Database:** PostgreSQL 15 via **Prisma ORM 6**
- **Cache / Sessions:** Redis 7 via **ioredis**
- **Validation:** **Zod 4** — schemas live in `*.schema.ts` per module
- **Auth:** JWT (access token 15 min / refresh token 7 days in httpOnly cookie)
- **SMS/OTP:** Twilio
- **Payments:** Razorpay (not yet implemented)
- **Logging:** Winston (never `console.log`)
- **Real-time:** Socket.io (planned — chat and calls modules)

**Do not introduce:**
- ORMs other than Prisma
- `any` anywhere in the codebase
- `console.log` / `console.error` (use Winston logger)
- Raw `Error` throws (use `AppError` from `src/shared/errors/app-error.ts`)
- `var` or CommonJS `require()` — project uses native ESM

---

## Architecture

The project follows a strict **vertical-slice module architecture** with a layered pattern inside each module:

```
src/
  modules/<feature>/
    <feature>.schema.ts     # Zod request validation schemas
    <feature>.repository.ts # Prisma DB queries ONLY — no business logic
    <feature>.service.ts    # Business logic — calls repository, never Prisma directly
    <feature>.controller.ts # Parse req → call service → send response
    <feature>.routes.ts     # Express Router with middleware wiring

  config/          # App config, DB/Prisma/Redis clients
  middlewares/     # authenticate, validate (Zod), error handler
  shared/
    errors/        # AppError class
    utils/         # logger
  utils/           # jwt, otp, sms, response helpers, serializers
  routes/index.ts  # Aggregates all module routers
  app.ts           # Express app setup (no listen)
  server.ts        # HTTP server entry point
```

**Rules:**
- Controllers must not contain business logic — delegate to services
- Services must not import Prisma directly — call repositories
- Repositories must not contain business logic — pure DB queries only
- New feature → new `src/modules/<feature>/` folder following the 5-file pattern
- Shared helpers go in `src/utils/` only if used by 2+ modules
- API keys are loaded via `src/config/app.config.ts` from `.env` — never access `process.env` directly outside of `app.config.ts`

---

## Spec-Driven Development (SDD)

**Golden Rule: Spec first. Always. No exceptions.**

Before writing any module code:
1. Spec file must exist and be approved: `specs/<feature>.spec.md`
2. Prisma schema must be updated if new models/fields are needed
3. Run `npm run db:migrate` to apply schema changes

**Order of implementation per module:**
`Schema (Zod) → Repository → Service → Controller → Routes → Tests`

When a spec changes: update the spec → update schema/migration if needed → update code. The spec is the source of truth.

Spec files live in `specs/` (note: directory may appear as `" specs"` on disk due to a leading space — reference it carefully in shell commands).

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no type assertions without justification
- Use `import type` for type-only imports (`verbatimModuleSyntax` is enabled)
- Named exports everywhere; no default exports except route files
- `async/await` only — no `.then()` chains
- All errors thrown as `new AppError(message, statusCode, code)` — never `new Error()`
- All responses use the `sendSuccess` / `sendError` helpers from `src/utils/response.ts`
- Winston logger only — `logger.info()`, `logger.warn()`, `logger.error()`
- File names: `camelCase.ts` (e.g., `authService.ts`) — modules use dots: `auth.service.ts`
- Redis keys follow the pattern: `domain:type:id` (e.g., `otp:+919876543210`)
- Error codes: `UPPER_SNAKE_CASE` strings (e.g., `OTP_INVALID`, `SESSION_NOT_FOUND`)
- API paths: kebab-case (e.g., `/send-otp`, `/verify-otp`)
- Keep functions focused and composable — aim for under 40 lines per function

---

## Response & Error Envelope

All responses **must** use this envelope:

```json
// Success
{ "success": true, "message": "Human-readable", "data": {} }

// Paginated success
{ "success": true, "message": "...", "data": [], "meta": { "page": 1, "limit": 20, "total": 100 } }

// Error
{ "success": false, "message": "Human-readable", "code": "ERROR_CODE", "errors": [] }
```

Never return raw data or non-envelope shapes.

---

## Authentication

- OTP sent via Twilio to phone (E.164 format)
- In development, magic OTP code is `123456` (set via `OTP_MAGIC_CODE` env var)
- Access token: 15-minute JWT in `Authorization: Bearer <token>` header
- Refresh token: 7-day JWT in `refreshToken` httpOnly cookie
- `authenticate` middleware in `src/middlewares/authenticate.ts` guards protected routes
- Do not modify auth token flows unless the task explicitly requires it

---

## Safe-Change Rules

- **Do not rename or remove API route paths** — clients depend on them
- **Do not modify the Prisma schema** without running `npm run db:migrate` and calling it out explicitly
- **Do not change the response envelope shape** — it is a contract with clients
- **Do not hard-delete records** — use soft delete (`deletedAt` timestamp)
- **Do not store money as floats** — always paise (integers)
- **Do not change auth middleware behavior** without explicit instruction
- Flag any architectural change before implementing; confirm with the user first

---

## Testing & Quality Bar

Before marking any task complete:
- `npm run build` must succeed (no TypeScript errors)
- Lint must pass (once linter is configured)

Testing rules:
- Add unit tests for service and repository logic in `tests/unit/`
- Add integration tests for API routes in `tests/integration/`
- Do not add test scaffolding for purely presentational or trivial pass-through code
- Verify error paths: invalid input, missing auth, not-found, and conflict cases

---

## Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start (build + run)
npm run dev

# Prisma — generate client after schema changes
npm run db:generate

# Prisma — apply migrations (dev)
npm run db:migrate

# Prisma — push schema directly (dev only, no migration file)
npm run db:push

# Docker — start PostgreSQL + Redis locally
docker-compose up -d
```

**Environment:** All required env vars are documented in `src/config/app.config.ts`. Copy `.env` for local development — never commit secrets.
