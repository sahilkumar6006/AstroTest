# 🏗️ Production-Grade TypeScript + Node.js Code Quality Standards

> A comprehensive, opinionated guide to writing enterprise-level TypeScript in Node.js projects.  
> Enforces SOLID principles, strict type safety, security, testing, and maintainability.

---

## 📋 Table of Contents

1. [Project Structure](#1-project-structure)
2. [TypeScript Configuration](#2-typescript-configuration)
3. [SOLID Principles](#3-solid-principles)
4. [Naming Conventions](#4-naming-conventions)
5. [Type Safety Standards](#5-type-safety-standards)
6. [Error Handling](#6-error-handling)
7. [Async / Await Patterns](#7-async--await-patterns)
8. [Dependency Injection & Code Style Preference](#8-dependency-injection--code-style-preference)
    - [8.1 Factory Function Pattern (Preferred for ES6+ Projects)](#81-factory-function-pattern-preferred-for-es6-projects)
    - [8.2 When to Use Classes](#82-when-to-use-classes)
    - [8.3 Decision Rule — Classes vs Factory Functions](#83-decision-rule--classes-vs-factory-functions)
    - [8.4 Class-Based Constructor Injection](#84-class-based-constructor-injection)
9. [Modularization & DRY](#9-modularization--dry)
10. [Security Best Practices](#10-security-best-practices)
11. [Logging Standards](#11-logging-standards)
12. [Testing Standards](#12-testing-standards)
13. [Code Style & Linting](#13-code-style--linting)
14. [Docker & Environment](#14-docker--environment)
15. [Performance Standards](#15-performance-standards)
16. [Git & CI/CD Standards](#16-git--cicd-standards)
17. [Forbidden Patterns](#17-forbidden-patterns)
18. [AOE Rules — Architecture, Observability & Evolution](#18-aoe-rules--architecture-observability--evolution)
    - [18.1 Architecture Rules](#181-architecture-rules)
    - [18.2 Observability Rules](#182-observability-rules)
    - [18.3 Evolution Rules](#183-evolution-rules)
19. [API Performance — Why APIs Are Slow & How to Fix Them](#19-api-performance--why-apis-are-slow--how-to-fix-them)
20. [Modern Node.js & JavaScript Standards (2024–2026)](#20-modern-nodejs--javascript-standards-20242026)
    - [20.1 Runtime — Always Target Node 24 LTS](#201-runtime--always-target-node-24-lts)
    - [20.2 Native TypeScript Execution](#202-native-typescript-execution)
    - [20.3 Built-in Test Runner — Drop Jest for New Projects](#203-built-in-test-runner--drop-jest-for-new-projects)
    - [20.4 Native env File — Drop dotenv](#204-native-env-file--drop-dotenv)
    - [20.5 Runtime Permission Model](#205-runtime-permission-model)
    - [20.6 Native WebSocket Client](#206-native-websocket-client)
    - [20.7 Built-in Watch Mode — Drop nodemon](#207-built-in-watch-mode--drop-nodemon)
    - [20.8 ES2024 / ES2025 Language Features](#208-es2024--es2025-language-features)
    - [20.9 Dependency Reduction Checklist](#209-dependency-reduction-checklist)
    - [20.10 Updated Forbidden Patterns](#2010-updated-forbidden-patterns)

---

## 1. Project Structure

Every Node.js TypeScript project **must** follow a layered, component-based folder structure.

```
project-root/
├── src/
│   ├── config/               # Environment config, constants
│   │   ├── app.config.ts
│   │   └── db.config.ts
│   ├── modules/              # Feature modules (vertical slices)
│   │   └── user/
│   │       ├── user.controller.ts
│   │       ├── user.service.ts
│   │       ├── user.repository.ts
│   │       ├── user.dto.ts
│   │       ├── user.entity.ts
│   │       ├── user.interface.ts
│   │       └── user.module.ts
│   ├── shared/               # Cross-cutting utilities
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   └── http-error.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   └── validator.ts
│   │   └── types/
│   │       └── global.d.ts
│   ├── app.ts                # Express app bootstrap (no server.listen)
│   └── server.ts             # HTTP server entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.ts
├── Dockerfile
├── docker-compose.yml
└── package.json
```

**Rules:**
- `app.ts` declares Express routes and middleware — it MUST NOT call `server.listen()`
- `server.ts` is the only file that boots the HTTP server
- Each feature lives in its own module folder under `src/modules/`
- Shared logic (middleware, utils, error types) lives in `src/shared/`
- No circular imports between modules

---

## 2. TypeScript Configuration

### `tsconfig.json` — Development

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "paths": {
      "@modules/*": ["./src/modules/*"],
      "@shared/*": ["./src/shared/*"],
      "@config/*": ["./src/config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Mandatory flags — never disable:**

| Flag | Reason |
|---|---|
| `strict: true` | Enables all strict type checks |
| `noImplicitAny` | Prevents untyped variables |
| `strictNullChecks` | Forces null/undefined handling |
| `noImplicitReturns` | All code paths must return |
| `noUncheckedIndexedAccess` | Array/object access is safely typed |

---

## 3. SOLID Principles

SOLID is **mandatory** for all service, repository, and utility classes.

---

### 3.1 Single Responsibility Principle (SRP)

> A class or function must have **one and only one reason to change**.

**❌ Violation — one class doing too much:**

```typescript
// BAD: UserService handles business logic, email sending, AND DB access
class UserService {
  async register(dto: CreateUserDto): Promise<void> {
    // Validation
    if (!dto.email.includes('@')) throw new Error('Invalid email');

    // DB Access
    const user = await db.query('INSERT INTO users ...', [dto.email]);

    // Email sending — NOT the service's job
    await nodemailer.sendMail({ to: dto.email, subject: 'Welcome!' });
  }
}
```

**✅ Correct — each class has one job:**

```typescript
// UserService: only business logic
class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly validator: IUserValidator,
  ) {}

  async register(dto: CreateUserDto): Promise<User> {
    this.validator.validate(dto);
    const user = await this.userRepository.create(dto);
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}

// UserRepository: only DB access
class UserRepository implements IUserRepository {
  async create(dto: CreateUserDto): Promise<User> { /* ... */ }
}

// EmailService: only email concerns
class EmailService implements IEmailService {
  async sendWelcome(email: string): Promise<void> { /* ... */ }
}
```

---

### 3.2 Open/Closed Principle (OCP)

> Classes should be **open for extension** but **closed for modification**.

**❌ Violation — must modify class to add new payment type:**

```typescript
// BAD: Adding Stripe requires editing this class
class PaymentProcessor {
  process(type: string, amount: number): void {
    if (type === 'paypal') { /* PayPal logic */ }
    else if (type === 'stripe') { /* Stripe logic */ } // ← forced modification
  }
}
```

**✅ Correct — extend via interface, never modify:**

```typescript
interface IPaymentGateway {
  process(amount: number): Promise<PaymentResult>;
}

class PayPalGateway implements IPaymentGateway {
  async process(amount: number): Promise<PaymentResult> { /* ... */ }
}

class StripeGateway implements IPaymentGateway {
  async process(amount: number): Promise<PaymentResult> { /* ... */ }
}

// New payment type = new class, zero changes to existing code
class CryptoGateway implements IPaymentGateway {
  async process(amount: number): Promise<PaymentResult> { /* ... */ }
}

class PaymentProcessor {
  constructor(private readonly gateway: IPaymentGateway) {}

  async charge(amount: number): Promise<PaymentResult> {
    return this.gateway.process(amount);
  }
}
```

---

### 3.3 Liskov Substitution Principle (LSP)

> Subtypes must be **fully substitutable** for their base types.

**❌ Violation — subclass breaks the contract:**

```typescript
// BAD: ReadOnlyRepository cannot honour save() — breaks the parent contract
class UserRepository {
  async save(user: User): Promise<void> { /* writes to DB */ }
}

class ReadOnlyUserRepository extends UserRepository {
  async save(_user: User): Promise<void> {
    throw new Error('Cannot write'); // ← LSP violation
  }
}
```

**✅ Correct — separate interfaces, no forced inheritance:**

```typescript
interface IReadableRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
}

interface IWritableRepository<T> extends IReadableRepository<T> {
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

class UserRepository implements IWritableRepository<User> { /* full CRUD */ }
class AuditLogRepository implements IReadableRepository<AuditLog> { /* read only */ }
```

---

### 3.4 Interface Segregation Principle (ISP)

> Clients should **not** be forced to depend on interfaces they do not use.

**❌ Violation — fat interface forces irrelevant implementations:**

```typescript
// BAD: ReportService is forced to implement sendEmail and sendSms
interface INotificationService {
  sendEmail(to: string, body: string): Promise<void>;
  sendSms(to: string, body: string): Promise<void>;
  sendPushNotification(token: string, body: string): Promise<void>;
  generateReport(data: unknown[]): string; // ← unrelated to notifications
}
```

**✅ Correct — granular, focused interfaces:**

```typescript
interface IEmailSender {
  sendEmail(to: string, body: string): Promise<void>;
}

interface ISmsSender {
  sendSms(to: string, body: string): Promise<void>;
}

interface IPushSender {
  sendPushNotification(token: string, body: string): Promise<void>;
}

interface IReportGenerator {
  generateReport(data: unknown[]): string;
}

// Classes only implement what they need
class EmailService implements IEmailSender { /* ... */ }
class SmsService implements ISmsSender { /* ... */ }

// Compose when needed
class FullNotificationService implements IEmailSender, ISmsSender {
  async sendEmail(to: string, body: string): Promise<void> { /* ... */ }
  async sendSms(to: string, body: string): Promise<void> { /* ... */ }
}
```

---

### 3.5 Dependency Inversion Principle (DIP)

> High-level modules must depend on **abstractions**, not concrete implementations.

**❌ Violation — controller depends on concrete class:**

```typescript
// BAD: Hard dependency on concrete PostgresUserRepository
import { PostgresUserRepository } from './postgres-user.repository';

class UserController {
  private repo = new PostgresUserRepository(); // ← cannot mock, cannot swap

  async getUser(req: Request, res: Response): Promise<void> {
    const user = await this.repo.findById(req.params.id);
    res.json(user);
  }
}
```

**✅ Correct — depend on the interface, inject the implementation:**

```typescript
// user.interface.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(dto: CreateUserDto): Promise<User>;
}

// user.controller.ts
class UserController {
  constructor(private readonly userRepository: IUserRepository) {}
  // Now injectable, testable, and swappable (Postgres → Mongo → In-memory)
}
```

---

## 4. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Class | `PascalCase` | `UserService`, `OrderRepository` |
| Interface | `PascalCase` prefixed with `I` | `IUserService`, `ILogger` |
| Type Alias | `PascalCase` | `UserPayload`, `PaginationOptions` |
| Enum | `PascalCase`, members `SCREAMING_SNAKE` | `UserRole.ADMIN` |
| Function / Method | `camelCase` | `getUserById`, `processPayment` |
| Variable / Parameter | `camelCase` | `userId`, `orderTotal` |
| Constant (module-level) | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| File name | `kebab-case` | `user.service.ts`, `auth.middleware.ts` |
| Directory | `kebab-case` | `user/`, `shared/errors/` |
| Boolean variable | prefix `is`, `has`, `can`, `should` | `isActive`, `hasPermission` |
| Private class member | prefix `_` (discouraged; use `private` keyword) | `private readonly _repo` |

**Naming rules:**
- NEVER use single-letter variables outside of loop indices (`i`, `j`)
- NEVER use abbreviations unless universally understood (`dto`, `id`, `url`, `http`)
- Function names must be **verb-noun**: `getUser`, `createOrder`, `validateEmail`
- Boolean-returning functions must start with `is`, `has`, `can`

```typescript
// ✅ Good
const isEmailValid = (email: string): boolean => /\S+@\S+\.\S+/.test(email);
const hasAdminRole = (user: User): boolean => user.role === UserRole.ADMIN;
const MAX_LOGIN_ATTEMPTS = 5;

// ❌ Bad
const chk = (e: string) => /\S+@\S+\.\S+/.test(e);
const admin = (u: User) => u.role === UserRole.ADMIN;
const max = 5;
```

---

## 5. Type Safety Standards

### 5.1 Never Use `any`

```typescript
// ❌ Banned
function processData(data: any): any { return data; }

// ✅ Use generics or unknown
function processData<T>(data: T): T { return data; }

// ✅ When type is truly unknown, use unknown + type guard
function processPayload(payload: unknown): User {
  if (!isUser(payload)) throw new AppError('Invalid payload', 400);
  return payload;
}
```

### 5.2 Use Type Guards

```typescript
// Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as User).email === 'string'
  );
}
```

### 5.3 DTO Validation with Zod

All incoming data (request bodies, env vars, external APIs) **must** be validated:

```typescript
// user.dto.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  age: z.number().int().min(18).max(120).optional(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

// Usage in controller
const dto = CreateUserSchema.parse(req.body); // throws ZodError on failure
```

### 5.4 Readonly and Immutability

```typescript
// ✅ Mark constructor-injected dependencies as readonly
class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly logger: ILogger,
  ) {}
}

// ✅ Use Readonly<T> for objects passed around
function renderUser(user: Readonly<User>): string {
  return `${user.name} <${user.email}>`;
}

// ✅ Prefer const assertions for static config
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NOT_FOUND: 404,
} as const;

type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
```

### 5.5 Discriminated Unions Over Booleans

```typescript
// ❌ Ambiguous boolean flags
interface ApiResponse {
  success: boolean;
  data?: User;
  error?: string;
}

// ✅ Discriminated union — exhaustively checkable
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: number };

function handleResponse(response: ApiResponse<User>): void {
  if (response.success) {
    console.log(response.data.email); // TypeScript knows data exists
  } else {
    console.error(response.error);    // TypeScript knows error exists
  }
}
```

---

## 6. Error Handling

### 6.1 Custom Error Hierarchy

```typescript
// shared/errors/app-error.ts
export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string = 'INTERNAL_ERROR',
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}
```

### 6.2 Centralized Error Middleware

```typescript
// shared/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, message: err.message, statusCode: err.statusCode });

    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
    return;
  }

  // Unknown / programming errors — never expose internals
  logger.error({ message: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
```

### 6.3 Always Await Before Returning

```typescript
// ❌ Partial stacktrace on rejection
async function getUser(id: string): Promise<User> {
  return userRepository.findById(id); // lost from stacktrace if it throws
}

// ✅ Full stacktrace preserved
async function getUser(id: string): Promise<User> {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundError('User');
  return user;
}
```

### 6.4 Unhandled Rejections & Uncaught Exceptions

```typescript
// server.ts
process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection — shutting down');
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ error }, 'Uncaught Exception — shutting down');
  process.exit(1);
});
```

---

## 7. Async / Await Patterns

### 7.1 Always Use async/await Over Raw Promises

```typescript
// ❌ Callback hell / promise chaining
getUserById(id)
  .then(user => getOrdersByUser(user.id))
  .then(orders => processOrders(orders))
  .catch(err => logger.error(err));

// ✅ Async/await — readable, debuggable
async function processUserOrders(userId: string): Promise<void> {
  const user = await getUserById(userId);
  const orders = await getOrdersByUser(user.id);
  await processOrders(orders);
}
```

### 7.2 Parallel Execution with Promise.all

```typescript
// ❌ Sequential when parallel is possible
const user = await userRepository.findById(userId);
const orders = await orderRepository.findByUser(userId);
const profile = await profileRepository.findByUser(userId);

// ✅ Run independent calls in parallel
const [user, orders, profile] = await Promise.all([
  userRepository.findById(userId),
  orderRepository.findByUser(userId),
  profileRepository.findByUser(userId),
]);
```

### 7.3 Typed Async Result (Result Pattern)

```typescript
// shared/types/result.ts
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <E extends Error>(error: E): Result<never, E> => ({ ok: false, error });

// Usage
async function findUser(id: string): Promise<Result<User>> {
  const user = await userRepository.findById(id);
  if (!user) return err(new NotFoundError('User'));
  return ok(user);
}

const result = await findUser('123');
if (!result.ok) {
  // handle error
  return;
}
console.log(result.value.email); // fully typed
```

---

## 8. Dependency Injection & Code Style Preference

> **Project-level rule:** Pick **one** style — factory functions or classes — and apply it consistently across the entire codebase. Never mix both styles for the same layer (e.g. some services as classes and some as factory functions). Document the choice in your ADR.

---

### 8.1 Factory Function Pattern (Preferred for ES6+ Projects)

> **Canonical standard.** This is the default code style for all ES6+ Node.js TypeScript projects in this codebase. Every new service, repository, and utility **must** be written as a factory function unless a specific exception listed in [§8.2](#82-when-to-use-classes) applies. When in doubt, refer back to this section first.

In modern Node.js with ES6+ and TypeScript you **do not need classes** for services, repositories, or utilities. The **factory function pattern** produces objects that are equally injectable, mockable, and type-safe — with less boilerplate and zero `this`-binding risk.

This is the **default recommendation** for all projects that are not using NestJS, InversifyJS, or TypeORM class-based entities.

```typescript
// user.interface.ts — define the contract as a type
export type UserService = {
  getById(id: string): Promise<User>;
  register(dto: CreateUserDto): Promise<User>;
  deleteById(id: string): Promise<void>;
};
```

```typescript
// user.service.ts — factory function, no class needed
import type { IUserRepository } from './user.repository';
import type { IEmailService }    from '../email/email.interface';
import type { UserService }      from './user.interface';
import { NotFoundError, ConflictError } from '@shared/errors/app-error';

export function createUserService(
  repo:         IUserRepository,
  emailService: IEmailService,
): UserService {
  return {
    async getById(id: string): Promise<User> {
      const user = await repo.findById(id);
      if (!user) throw new NotFoundError('User');
      return user;
    },

    async register(dto: CreateUserDto): Promise<User> {
      const existing = await repo.findByEmail(dto.email);
      if (existing) throw new ConflictError('Email already in use');
      const user = await repo.create(dto);
      await emailService.sendWelcome(user.email);
      return user;
    },

    async deleteById(id: string): Promise<void> {
      const user = await repo.findById(id);
      if (!user) throw new NotFoundError('User');
      await repo.delete(id);
    },
  };
}
```

```typescript
// Composition root — app.ts or a dedicated container.ts
import { createUserService }      from '@modules/user/user.service';
import { createUserRepository }   from '@modules/user/user.repository';
import { createEmailService }     from '@modules/email/email.service';

const userRepository = createUserRepository(db);
const emailService   = createEmailService(smtpClient);
const userService    = createUserService(userRepository, emailService);

// Inject into router/controller
const userController = createUserController(userService);
app.use('/api/v1/users', userController.router);
```

**Why factory functions are preferred in ES6+ projects:**

| Property | Factory Function | Class |
|---|---|---|
| Requires `this` keyword | No | Yes — binding bugs are common |
| Tree-shakeable | Yes | No |
| Closure-based private state | Yes — no `private` keyword needed | Yes — but `private` is TypeScript-only |
| Works without `new` | Yes | No |
| Decorator support needed | No | Yes (NestJS / InversifyJS require it) |
| Easier to mock in tests | Yes — just pass a plain object | Yes — but requires more setup |
| Boilerplate | Less | More |

```typescript
// ✅ Testing with factory function — trivial to mock
const mockRepo: IUserRepository = {
  findById:    jest.fn().mockResolvedValue({ id: '1', email: 'a@b.com' }),
  findByEmail: jest.fn().mockResolvedValue(null),
  create:      jest.fn(),
  delete:      jest.fn(),
};

const mockEmail: IEmailService = {
  sendWelcome: jest.fn().mockResolvedValue(undefined),
};

// No class instantiation, no `new`, no constructor setup
const sut = createUserService(mockRepo, mockEmail);
```

---

### 8.2 When to Use Classes

Classes are the right tool in these specific scenarios. Outside of them, prefer factory functions.

| Scenario | Why classes are required or better |
|---|---|
| **Error hierarchy** | `class NotFoundError extends AppError` — the only clean way to do inheritance |
| **NestJS services / controllers** | Framework requires class + `@Injectable()` decorator |
| **InversifyJS containers** | Requires class + `@injectable()` + `@inject()` |
| **TypeORM / MikroORM entities** | Framework requires class + column decorators |
| **Interface enforcement at compile time** | `class UserRepo implements IUserRepository` — TypeScript checks every method |
| **Stateful singletons with complex lifecycle** | When you need `init()`, `destroy()`, and multiple methods sharing internal state |

```typescript
// ✅ ALWAYS use classes for error hierarchies
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError   extends AppError {
  constructor(resource: string) { super(`${resource} not found`, 404, 'NOT_FOUND'); }
}
export class ValidationError extends AppError {
  constructor(msg: string)     { super(msg, 400, 'VALIDATION_ERROR'); }
}
export class ConflictError   extends AppError {
  constructor(msg: string)     { super(msg, 409, 'CONFLICT'); }
}
export class UnauthorizedError extends AppError {
  constructor()                { super('Unauthorized', 401, 'UNAUTHORIZED'); }
}
```

```typescript
// ✅ ALWAYS use classes for ORM entities (TypeORM example)
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ select: false }) // never returned in queries by default
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

```typescript
// ✅ Use class when you need interface enforcement at compile time
export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, name FROM users WHERE id = $1', [id]
    );
    return result.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, name FROM users WHERE email = $1', [email]
    );
    return result.rows[0] ?? null;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const result = await this.db.query<User>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name',
      [dto.email, dto.name]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
  }
}
```

---

### 8.3 Decision Rule — Classes vs Factory Functions

```
Start here → Are you using NestJS, InversifyJS, TypeORM, or MikroORM?
│
├── YES → Use classes. The framework requires them.
│
└── NO → Are you defining an error type or ORM entity?
    │
    ├── YES → Use a class. (extends / decorators needed)
    │
    └── NO → Do you need compile-time interface enforcement
             (implements keyword on a repository/adapter)?
        │
        ├── YES → Use a class with implements.
        │
        └── NO → Use a factory function. ✅ Default choice.
```

**Never use a class just because it feels more "enterprise". A factory function that accepts its dependencies as arguments and returns a plain object is:**
- Equally SOLID-compliant
- Equally testable
- Easier to read for developers coming from a functional background
- Zero risk of `this`-binding bugs

---

### 8.4 Class-Based Constructor Injection

When you do use classes, **always inject via constructor**. Never use `new` inside a class body for dependencies — it creates a hidden coupling that cannot be mocked or swapped.

```typescript
// ❌ Hidden dependency — cannot test without a real DB
class OrderService {
  private repo = new PostgresOrderRepository(); // tightly coupled, untestable
}

// ✅ Constructor injection — testable, swappable, SOLID-compliant
class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly paymentGateway:  IPaymentGateway,
    private readonly logger:          ILogger,
  ) {}

  async placeOrder(dto: PlaceOrderDto): Promise<Order> {
    const order = await this.orderRepository.create(dto);
    await this.paymentGateway.charge(order.total);
    this.logger.info({ orderId: order.id }, 'Order placed');
    return order;
  }
}

// Composition root — the ONLY place where `new` is called
const orderService = new OrderService(
  new PostgresOrderRepository(db),
  new StripeGateway(stripeClient),
  logger,
);
```

For large class-based projects, use [tsyringe](https://github.com/microsoft/tsyringe) or [InversifyJS](https://inversify.io/) to manage the composition root automatically:

```typescript
// With tsyringe
import { injectable, inject, container } from 'tsyringe';

@injectable()
class OrderService {
  constructor(
    @inject('IOrderRepository') private readonly repo: IOrderRepository,
    @inject('IPaymentGateway')  private readonly gw:   IPaymentGateway,
  ) {}
}

// Register once at startup
container.register('IOrderRepository', { useClass: PostgresOrderRepository });
container.register('IPaymentGateway',  { useClass: StripeGateway });

const orderService = container.resolve(OrderService);
```

---

## 9. Modularization & DRY

### 9.1 Module Index Barrel Exports

```typescript
// modules/user/index.ts
export { UserController } from './user.controller';
export { UserService } from './user.service';
export type { IUserService } from './user.interface';
export { CreateUserSchema } from './user.dto';

// Consumers import cleanly
import { UserService, CreateUserSchema } from '@modules/user';
```

### 9.2 Utility Functions Must Be Pure

```typescript
// ✅ Pure, testable, reusable utility
export function paginate<T>(items: T[], page: number, limit: number): T[] {
  const offset = (page - 1) * limit;
  return items.slice(offset, offset + limit);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}
```

### 9.3 Generic Repository Base (DRY)

```typescript
// shared/repositories/base.repository.ts
export interface IBaseRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}
```

---

## 10. Security Best Practices

### 10.1 Environment Variables

```typescript
// config/app.config.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),
});

export const config = EnvSchema.parse(process.env); // fail-fast at startup
```

### 10.2 HTTP Security Headers (Helmet)

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.contentSecurityPolicy());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests' },
});

app.use('/api/', limiter);
```

### 10.3 Parameterized Queries — Never String Interpolation

```typescript
// ❌ SQL Injection vulnerability
const users = await db.query(`SELECT * FROM users WHERE id = ${userId}`);

// ✅ Parameterized query
const users = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// ✅ With TypeORM
const user = await userRepository.findOne({ where: { id: userId } });
```

### 10.4 Password Handling

```typescript
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = config.BCRYPT_ROUNDS; // minimum 12 in production

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

### 10.5 Input Validation Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError(result.error.issues[0]?.message ?? 'Invalid input'));
      return;
    }
    req.body = result.data;
    next();
  };

// Router usage
router.post('/users', validate(CreateUserSchema), userController.create);
```

---

## 11. Logging Standards

Use **structured JSON logging** in production. Never use `console.log`.

```typescript
// shared/utils/logger.ts
import pino from 'pino';
import { config } from '@config/app.config';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(config.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
  redact: ['req.headers.authorization', 'body.password', 'body.token'],
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

export type Logger = typeof logger;
```

**Logging rules:**

```typescript
// ✅ Structured logging — queryable, parseable
logger.info({ userId, action: 'LOGIN', ip: req.ip }, 'User logged in');
logger.error({ err, requestId }, 'Database query failed');
logger.warn({ attempts, userId }, 'Rate limit approaching');

// ❌ Unstructured — unsearchable in production
console.log('User ' + userId + ' logged in');
logger.info('Database query failed: ' + err.message);
```

**Log levels:**

| Level | When to use |
|---|---|
| `fatal` | Unrecoverable — app must exit |
| `error` | Caught errors needing investigation |
| `warn` | Unexpected but recoverable conditions |
| `info` | Key business events (login, order placed) |
| `debug` | Developer diagnostic info (dev only) |
| `trace` | Verbose tracing (never in production) |

---

## 12. Testing Standards

### 12.1 Structure: Arrange → Act → Assert (AAA)

```typescript
// tests/unit/user.service.spec.ts
describe('UserService', () => {
  describe('register', () => {
    it('should return a new user when valid DTO is provided', async () => {
      // Arrange
      const dto: CreateUserDto = { email: 'test@example.com', name: 'Test User', role: UserRole.USER };
      const mockUser: User = { id: '1', ...dto, createdAt: new Date() };
      mockUserRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await userService.register(dto);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(dto);
      expect(mockEmailService.sendWelcome).toHaveBeenCalledWith(dto.email);
    });

    it('should throw ValidationError when email is invalid', async () => {
      // Arrange
      const dto = { email: 'not-an-email', name: 'Test' };

      // Act & Assert
      await expect(userService.register(dto as CreateUserDto))
        .rejects
        .toThrow(ValidationError);
    });
  });
});
```

### 12.2 Mock Patterns

```typescript
// Always mock at the interface level, not the concrete class
const mockUserRepository: jest.Mocked<IUserRepository> = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

### 12.3 Coverage Requirements

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};

export default config;
```

**Mandatory test categories:**

| Category | Location | What to test |
|---|---|---|
| Unit | `tests/unit/` | Services, utilities, validators |
| Integration | `tests/integration/` | Repository + real DB, API routes |
| E2E | `tests/e2e/` | Full HTTP flows |

---

## 13. Code Style & Linting

### `.eslintrc.json`

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "project": "./tsconfig.json" },
  "plugins": ["@typescript-eslint", "import", "security"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/typescript",
    "plugin:security/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "error",
    "eqeqeq": ["error", "always"],
    "import/no-cycle": "error",
    "import/order": ["error", { "alphabetize": { "order": "asc" } }]
  }
}
```

### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### `package.json` scripts

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "lint": "eslint 'src/**/*.ts' --max-warnings 0",
    "lint:fix": "eslint 'src/**/*.ts' --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts'",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "type-check": "tsc --noEmit",
    "audit": "npm audit --audit-level=high",
    "prepare": "husky install"
  }
}
```

---

## 14. Docker & Environment

### `Dockerfile` (Multi-stage)

```dockerfile
# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build


# ---- Production Stage ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Docker rules:**
- NEVER use `npm start` in Dockerfile — use `node dist/server.js` directly
- ALWAYS run as a non-root user
- ALWAYS use multi-stage builds to exclude dev dependencies
- ALWAYS run `npm cache clean --force` after install

---

## 15. Performance Standards

### 15.1 Never Block the Event Loop

```typescript
// ❌ Blocks event loop — CPU-intensive work on main thread
function computeHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length * 100000; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i % data.length);
  }
  return hash.toString(16);
}

// ✅ Offload CPU work to worker threads
import { Worker } from 'worker_threads';

function computeHashAsync(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/hash.worker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

### 15.2 Prefer Native Over Utility Libraries

```typescript
// ❌ Unnecessary lodash dependency
import _ from 'lodash';
const sorted = _.sortBy(users, 'name');
const unique = _.uniqBy(users, 'id');

// ✅ Native — faster, no dependency
const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
const unique = [...new Map(users.map(u => [u.id, u])).values()];
```

### 15.3 Use Pagination — Never Unbounded Queries

```typescript
// ❌ Loads entire table into memory
const allUsers = await userRepository.findAll();

// ✅ Cursor-based or offset pagination
async function getUsers(page: number, limit: number): Promise<PaginatedResult<User>> {
  const [users, total] = await userRepository.findAndCount({
    skip: (page - 1) * limit,
    take: Math.min(limit, 100), // hard cap
    order: { createdAt: 'DESC' },
  });
  return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

---

## 16. Git & CI/CD Standards

### Commit Message Format (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Examples:**

```
feat(user): add email verification on registration
fix(auth): resolve JWT expiry not being validated
refactor(order): extract payment logic into PaymentService
test(user): add unit tests for UserService.register
```

### CI Pipeline Requirements (GitHub Actions / GitLab CI)

Every PR/MR **must** pass all of these gates before merge:

```yaml
# .github/workflows/ci.yml
jobs:
  quality:
    steps:
      - run: npm ci
      - run: npm run type-check        # zero TypeScript errors
      - run: npm run lint              # zero ESLint warnings or errors
      - run: npm run format:check      # Prettier formatting enforced
      - run: npm run test:coverage     # coverage thresholds enforced
      - run: npm audit --audit-level=high  # no high/critical vulnerabilities
```

---

## 17. Forbidden Patterns

The following patterns are **banned** and will fail code review:

| Pattern | Why it's banned | Alternative |
|---|---|---|
| `any` type | Defeats TypeScript | `unknown` + type guard, or generics |
| `console.log` | Unstructured, lost in production | `logger.info()` |
| `var` keyword | Function-scoped, hoisted | `const` / `let` |
| `==` / `!=` | Type coercion bugs | `===` / `!==` |
| `new` inside class body | Creates hidden dependencies | Constructor injection |
| String SQL concatenation | SQL injection | Parameterized queries |
| Returning raw Error stacks | Leaks implementation details | Custom error response |
| `@ts-ignore` / `@ts-nocheck` | Silences real bugs | Fix the type error |
| Unbounded DB queries | OOM / DoS risk | Always paginate |
| Secrets in source code | Security breach | Environment variables |
| `process.exit()` in handlers | Kills all connections | Graceful shutdown |
| `require()` in TypeScript | Mixed module systems | `import` statements |

---

## Quick Reference Card

```
Project       → Layered modules, separate app.ts / server.ts
TypeScript    → strict: true, no any, explicit return types
SOLID         → SRP per class, DIP via interfaces, ISP with granular contracts
Naming        → PascalCase classes, camelCase functions, SCREAMING_SNAKE constants
Errors        → Custom hierarchy, centralized handler, never expose stacks
Async         → Always await before return, parallel with Promise.all
Security      → Validate all input (Zod), parameterized queries, Helmet
Logging       → Structured JSON (pino), never console.log
Testing       → AAA pattern, mock interfaces, 80%+ coverage required
Docker        → Multi-stage, non-root user, node cmd (not npm start)
Git           → Conventional commits, CI gates must pass before merge
AOE           → Layered arch, health checks, feature flags, versioned APIs
```

---

## 18. AOE Rules — Architecture, Observability & Evolution

AOE rules govern three concerns that cut across every other standard: how the system is **structured at scale** (Architecture), how you **see inside it in production** (Observability), and how it **grows safely over time** (Evolution). These are senior-level expectations — every production service must satisfy them.

---

### 18.1 Architecture Rules

#### A1 — Strict Layer Ordering

Dependencies must only flow **inward** (Controller → Service → Repository). No layer may import from a layer above it.

```
┌─────────────────────────────────────┐
│  Controllers  (HTTP / transport)    │  ← depends on Services only
├─────────────────────────────────────┤
│  Services     (business logic)      │  ← depends on Repositories / interfaces
├─────────────────────────────────────┤
│  Repositories (data access)         │  ← depends on DB client only
└─────────────────────────────────────┘
```

```typescript
// ❌ Service importing from Controller — layer violation
import { Request } from 'express';
class UserService {
  async getUser(req: Request) { /* ... */ } // Express bleeds into business logic
}

// ✅ Service knows nothing about HTTP
class UserService {
  async getUser(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }
}
```

**Rule:** Never pass `Express.Request` or `Express.Response` into a Service or Repository. Map at the controller boundary.

---

#### A2 — No Circular Dependencies

Circular imports cause runtime `undefined` errors that are hard to debug. Detect them at CI time.

```bash
# Install madge
npm install --save-dev madge

# Fail CI if any circular dependency exists
npx madge --circular --extensions ts src/
```

Add to `package.json`:
```json
{
  "scripts": {
    "check:circular": "madge --circular --extensions ts src/ && echo 'No circular deps'"
  }
}
```

**Rule:** `import/no-cycle` ESLint rule must be set to `"error"`. Zero tolerance.

---

#### A3 — Separation of `app.ts` and `server.ts`

```typescript
// app.ts — Express declaration only, NO server.listen()
import express from 'express';
import { userRouter } from '@modules/user';
import { globalErrorHandler } from '@shared/middleware/error.middleware';

export const app = express();
app.use(express.json());
app.use('/api/v1/users', userRouter);
app.use(globalErrorHandler);

// server.ts — the ONLY place that starts the HTTP server
import { app } from './app';
import { config } from '@config/app.config';
import { logger } from '@shared/utils/logger';

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server started');
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

**Why:** `app.ts` can be imported by integration tests without binding a port. `server.ts` is the runtime entry point only.

---

#### A4 — API Versioning from Day One

```typescript
// ✅ Always namespace your routes under a version prefix
app.use('/api/v1/users',   userRouterV1);
app.use('/api/v1/orders',  orderRouterV1);

// When breaking changes are needed, add v2 — never modify v1
app.use('/api/v2/users',   userRouterV2);
```

**Rules:**
- Version prefix is mandatory on all API routes: `/api/v{n}/`
- Never make breaking changes to an existing version — add a new one
- Deprecate old versions with an `X-Deprecated: true` response header and a sunset date

---

#### A5 — Single Responsibility Per File, 300-line Hard Cap

```
✅ Allowed file sizes
  user.service.ts       → business logic only      (< 200 lines ideal)
  user.repository.ts    → DB access only            (< 200 lines ideal)
  user.controller.ts    → HTTP mapping only         (< 150 lines ideal)

❌ God files
  user.ts               → everything in one file    (> 400 lines → must split)
```

**Rule:** No TypeScript file may exceed 300 lines (excluding blank lines and comments). Enforce with ESLint `max-lines` rule:

```json
{
  "rules": {
    "max-lines": ["error", { "max": 300, "skipBlankLines": true, "skipComments": true }]
  }
}
```

---

#### A6 — Feature Flags Over Risky Direct Deploys

For any change that affects live traffic behaviour (new endpoints, algorithm changes, pricing logic), use a feature flag to decouple deploy from release:

```typescript
// shared/utils/feature-flags.ts
export const FEATURE_FLAGS = {
  NEW_PRICING_ENGINE: process.env.FF_NEW_PRICING_ENGINE === 'true',
  BETA_DASHBOARD:     process.env.FF_BETA_DASHBOARD === 'true',
} as const;

// Usage in service
import { FEATURE_FLAGS } from '@shared/utils/feature-flags';

class PricingService {
  calculate(order: Order): number {
    if (FEATURE_FLAGS.NEW_PRICING_ENGINE) {
      return this.newEngine.calculate(order);
    }
    return this.legacyEngine.calculate(order);
  }
}
```

**Rules:**
- All feature flags are environment-variable driven — no hardcoded booleans
- Remove stale flags within one sprint of full rollout
- Flag names are `SCREAMING_SNAKE_CASE` prefixed with `FF_`

---

### 18.2 Observability Rules

#### O1 — Health Check Endpoints (Mandatory)

Every service **must** expose `/health/live` and `/health/ready`:

```typescript
// shared/middleware/health.middleware.ts
import { Router, Request, Response } from 'express';
import { db } from '@config/db.config';

export const healthRouter = Router();

// Liveness: is the process alive?
healthRouter.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: is the service ready to accept traffic?
healthRouter.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  try {
    await db.query('SELECT 1'); // probe DB connection
    res.status(200).json({ status: 'ready', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'not ready', db: 'disconnected' });
  }
});

// In app.ts — health routes bypass auth middleware
app.use('/health', healthRouter);
```

**Rules:**
- `/health/live` — fast (< 5ms), no external calls, just confirms process is up
- `/health/ready` — checks all critical dependencies (DB, cache, queue)
- Both must be excluded from authentication middleware
- Both must be excluded from rate limiting

---

#### O2 — Structured Request Logging with Correlation IDs

Every inbound request must receive a unique `correlationId` that propagates through all logs:

```typescript
// shared/middleware/correlation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export const correlationStore = new AsyncLocalStorage<{ correlationId: string }>();

export function correlationMiddleware(
  req: Request, res: Response, next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  correlationStore.run({ correlationId }, next);
}

// shared/utils/logger.ts — inject correlationId into every log
export const logger = pino({
  mixin() {
    const store = correlationStore.getStore();
    return store ? { correlationId: store.correlationId } : {};
  },
  redact: ['req.headers.authorization', 'body.password'],
});
```

**Result — every log line automatically includes the correlation ID:**
```json
{ "level": "info", "correlationId": "f3a1-...", "userId": "123", "msg": "User logged in" }
{ "level": "error", "correlationId": "f3a1-...", "err": {}, "msg": "DB query failed" }
```

---

#### O3 — Metrics Exposure (Prometheus-Compatible)

```typescript
// shared/middleware/metrics.middleware.ts
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

const registry = new Registry();
collectDefaultMetrics({ register: registry }); // CPU, memory, event loop lag

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export function metricsMiddleware(
  req: Request, res: Response, next: NextFunction
): void {
  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, route: req.path, status_code: res.statusCode });
    end();
  });
  next();
}

// Expose metrics endpoint (internal only — never public)
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

**Mandatory metrics every service must track:**

| Metric | Type | Why |
|---|---|---|
| `http_requests_total` | Counter | Request volume and error rates |
| `http_request_duration_seconds` | Histogram | Latency percentiles (p50/p95/p99) |
| `db_query_duration_seconds` | Histogram | Database performance |
| `active_connections` | Gauge | Connection pool utilization |
| Node.js default metrics | Auto | CPU, memory, event loop lag |

---

#### O4 — Distributed Tracing Readiness

```typescript
// shared/utils/tracer.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, string | number>,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer('node-service');
  const span = tracer.startSpan(spanName, { attributes });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

// Usage in service
async getUser(id: string): Promise<User> {
  return withSpan('UserService.getUser', { userId: id }, async () => {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  });
}
```

---

#### O5 — Alerting Contract

Every service must define its SLOs and alert thresholds in a documented contract:

```yaml
# slo.yaml — committed with the service
service: user-service
slos:
  availability:
    target: 99.9%
    alert_threshold: 99.5%        # alert before breaching SLO
  latency_p99:
    target: 500ms
    alert_threshold: 400ms
  error_rate:
    target: < 0.1%
    alert_threshold: 0.05%
alerts:
  - name: HighErrorRate
    condition: http_error_rate > 0.05% for 5m
    severity: critical
  - name: SlowResponses
    condition: p99_latency > 400ms for 10m
    severity: warning
```

---

### 18.3 Evolution Rules

#### E1 — Backward-Compatible DB Migrations Only

All database schema changes must be backward-compatible with the **currently deployed** version of the service. This enables zero-downtime deployments.

```
Deployment sequence:
  1. Deploy migration (additive change only)
  2. Verify DB health
  3. Deploy new application code
  4. (Optional) Deploy cleanup migration after code is stable

✅ Safe migration operations:
  - ADD COLUMN with DEFAULT or nullable
  - CREATE INDEX CONCURRENTLY
  - CREATE new table
  - ADD new foreign key (nullable)

❌ Unsafe — requires downtime or multi-step:
  - DROP COLUMN (old code still reads it)
  - RENAME COLUMN (breaks old code immediately)
  - NOT NULL constraint on existing column with no default
  - CHANGE data type (may break old code reads)
```

```typescript
// Migrations use a tool like node-pg-migrate or Prisma Migrate
// Each migration file is immutable once merged — never edit a deployed migration

// ✅ Safe: add nullable column
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('users', {
    phone_number: { type: 'varchar(20)', notNull: false }, // nullable = safe
  });
}

// ✅ Safe: remove column in a later, separate migration AFTER code no longer reads it
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('users', 'legacy_field');
}
```

---

#### E2 — Deprecation Protocol for APIs

When removing or changing a public API endpoint, follow this three-phase protocol:

```
Phase 1 — Announce (at least 2 sprints before removal)
  - Add Deprecation header to responses
  - Add warning log on every call to deprecated endpoint
  - Document sunset date in API changelog

Phase 2 — Warn
  - Log at WARN level with caller details
  - Return HTTP 200 with deprecation notice in response body

Phase 3 — Remove
  - Return HTTP 410 Gone with migration guide URL
  - Remove code in the following sprint
```

```typescript
// Deprecation middleware
export const deprecate = (sunsetDate: string, migrationUrl: string) =>
  (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('Link', `<${migrationUrl}>; rel="successor-version"`);
    logger.warn({ path: _req.path, sunsetDate }, 'Deprecated endpoint called');
    next();
  };

// Router usage
router.get('/v1/users/:id',
  deprecate('2026-09-01', 'https://docs.example.com/api/v2/users'),
  userControllerV1.getById
);
```

---

#### E3 — Dependency Update Policy

Dependencies are a primary attack surface. Outdated packages are a security liability.

```bash
# Check for outdated packages (add to CI weekly job)
npx npm-check-updates --doctor

# Security audit (runs on every PR)
npm audit --audit-level=high

# Automated PR creation for updates (use Dependabot or Renovate)
# .github/dependabot.yml
```

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      dev-dependencies:
        dependency-type: "development"
```

**Rules:**
- `npm audit` must pass with zero high/critical findings before any deployment
- All dependencies must be pinned to exact versions in `package-lock.json` — use `npm ci` in CI, never `npm install`
- Review and update all dependencies at minimum once per sprint
- Never use a package with zero weekly downloads or last published > 2 years ago without explicit justification

---

#### E4 — Changelogs and Release Notes

```markdown
# CHANGELOG.md format (Keep a Changelog standard)

## [Unreleased]

## [2.1.0] - 2026-03-25
### Added
- POST /api/v2/users/bulk for batch user creation
- Correlation ID propagation via AsyncLocalStorage

### Changed
- UserService.register now validates phone_number field (non-breaking, optional field)

### Deprecated
- GET /api/v1/users/:id — sunset 2026-09-01, use v2

### Fixed
- Fix race condition in OrderService.placeOrder under high concurrency

### Security
- Upgraded bcrypt to 5.1.1 (CVE-2023-XXXX)
```

**Rules:**
- Every PR that changes public API behaviour **must** update `CHANGELOG.md`
- Version numbers follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`
  - `MAJOR` — breaking change
  - `MINOR` — backward-compatible new feature
  - `PATCH` — backward-compatible bug fix

---

#### E5 — Architecture Decision Records (ADRs)

Every significant architectural decision must be documented in an ADR file, committed alongside the code:

```
docs/
└── adr/
    ├── 0001-use-postgresql-over-mongodb.md
    ├── 0002-adopt-zod-for-validation.md
    └── 0003-use-pino-over-winston.md
```

```markdown
# ADR-0003: Use Pino over Winston for logging

**Date:** 2026-01-15  
**Status:** Accepted  
**Deciders:** Engineering Team

## Context
We needed a structured JSON logger for production. Evaluated Winston and Pino.

## Decision
Use Pino.

## Rationale
- Pino is 5–8× faster than Winston (benchmarked at 35k logs/sec vs 7k)
- Native JSON output with built-in redaction
- `pino-pretty` for local development
- Smaller bundle size (no transports system overhead)

## Consequences
- All future logging must use the shared logger from `@shared/utils/logger`
- `console.log` is banned (enforced by ESLint `no-console: error`)
- Winston knowledge is no longer required for new team members
```

**Rules:**
- Any decision that would be difficult or costly to reverse requires an ADR
- ADRs are immutable once accepted — if the decision changes, write a new ADR superseding the old one
- ADR numbering is sequential and never reused

---

## Quick Reference Card

```
Project       → Layered modules, separate app.ts / server.ts
TypeScript    → strict: true, no any, explicit return types
SOLID         → SRP per class, DIP via interfaces, ISP with granular contracts
Naming        → PascalCase classes, camelCase functions, SCREAMING_SNAKE constants
Errors        → Custom hierarchy, centralized handler, never expose stacks
Async         → Always await before return, parallel with Promise.all
DI Style      → Factory functions by default; classes only for errors, ORM entities,
                interface enforcement, or framework-required (NestJS/InversifyJS)
Security      → Validate all input (Zod), parameterized queries, Helmet
Logging       → Structured JSON (pino), never console.log
Testing       → AAA pattern, mock interfaces, 80%+ coverage required
Docker        → Multi-stage, non-root user, node cmd (not npm start)
Git           → Conventional commits, CI gates must pass before merge
AOE / Arch    → Strict layer ordering, no circular deps, API versioned, 300-line cap
AOE / Obs     → /health endpoints, correlation IDs, Prometheus metrics, SLO contract
AOE / Evol    → Backward-compat migrations, deprecation protocol, ADRs, changelog
API Perf      → Promise.all for parallel, indexes, no N+1, Redis cache, worker threads
```

---

## 19. API Performance — Why APIs Are Slow & How to Fix Them

Slow APIs almost always trace back to one of five root causes. This section is the **mandatory reference before any performance investigation**. Check causes in order — the top ones are the most common.

---

### 19.1 Cause 1 — Sequential Awaits That Could Be Parallel

**The most common cause. Fix this first.**

When you `await` operations that are independent of each other, you pay their latency costs one by one. `Promise.all` runs them simultaneously and you only pay the cost of the slowest one.

```typescript
// ❌ Sequential — total time = sum of all calls (300ms)
const user    = await userRepo.findById(userId);      // 100ms
const orders  = await orderRepo.findByUser(userId);   // 100ms
const profile = await profileRepo.findByUser(userId); // 100ms
// Total: 300ms

// ✅ Parallel — total time = slowest single call (100ms)
const [user, orders, profile] = await Promise.all([
  userRepo.findById(userId),
  orderRepo.findByUser(userId),
  profileRepo.findByUser(userId),
]);
// Total: 100ms
```

**Rule:** Any time you see two or more sequential `await` calls where the second does not depend on the result of the first, replace them with `Promise.all`.

---

### 19.2 Cause 2 — Missing Database Indexes

An unindexed query against a large table performs a full sequential scan — it reads every row. This is instant on 1,000 rows and catastrophic on 1,000,000.

```sql
-- Diagnose: look for "Seq Scan" — this means no index is being used
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Fix: create an index on the column you filter/sort by
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- After the index: EXPLAIN ANALYZE should now show "Index Scan"
```

```typescript
// Columns that almost always need an index:
// - Foreign keys (user_id, order_id, etc.)
// - Email, username, slug (unique lookups)
// - status (WHERE status = 'ACTIVE')
// - created_at (ORDER BY created_at DESC, date range queries)
// - Any column used in WHERE, ORDER BY, or JOIN ON clauses frequently
```

**Migration pattern — always use CONCURRENTLY so the index builds without locking the table:**

```sql
-- ✅ Safe for production — does not lock the table
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- Composite index for queries that filter on two columns together
CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders(user_id, status);
```

---

### 19.3 Cause 3 — The N+1 Query Problem

You fetch a list of N items, then make one additional DB query per item. The result is N+1 database round trips instead of 2. On 100 items this is the difference between 2ms and 200ms.

```typescript
// ❌ N+1 — 1 query for orders + 1 query PER order for its user
const orders = await orderRepo.findAll();          // 1 query → 100 rows
for (const order of orders) {
  order.user = await userRepo.findById(order.userId); // 100 queries!
}
// Total: 101 DB round trips

// ✅ Fix A — batch fetch with WHERE IN
const orders  = await orderRepo.findAll();
const userIds = [...new Set(orders.map(o => o.userId))];
const users   = await userRepo.findByIds(userIds);   // 1 query
const userMap = new Map(users.map(u => [u.id, u]));
orders.forEach(o => { o.user = userMap.get(o.userId); });
// Total: 2 DB round trips

// ✅ Fix B — ORM eager loading (generates a JOIN — single query)
const orders = await orderRepo.find({
  relations: ['user'],  // TypeORM
});
```

**How to detect N+1 in development:** Enable query logging and watch for the same query executing in a loop:

```typescript
// In your DB config for development only
const db = new DataSource({
  logging: ['query'],  // TypeORM — logs every SQL query to console
});
```

---

### 19.4 Cause 4 — No Caching on Repeated Identical Work

If the same data is fetched on every request and changes infrequently, you are hitting the database unnecessarily. Cache it.

```typescript
// shared/utils/cache.ts
import { createClient } from 'redis';

const redis = createClient({ url: config.REDIS_URL });
await redis.connect();

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // 1. Try cache first — sub-millisecond
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Cache miss or Redis unavailable — fall through to DB
  }

  // 2. Cache miss — fetch from source
  const value = await fetcher();

  // 3. Store in cache — fire and forget (don't await, don't slow down response)
  redis.setEx(key, ttlSeconds, JSON.stringify(value)).catch(() => {});

  return value;
}

// Usage in service
async function getUserById(id: string): Promise<User> {
  return withCache(
    `user:${id}`,
    300, // 5 minutes TTL
    () => userRepo.findById(id).then(u => {
      if (!u) throw new NotFoundError('User');
      return u;
    }),
  );
}
```

**Cache invalidation — always invalidate on mutation:**

```typescript
async function updateUser(id: string, dto: UpdateUserDto): Promise<User> {
  const updated = await userRepo.update(id, dto);
  await redis.del(`user:${id}`); // ← invalidate immediately after write
  return updated;
}
```

**What to cache vs what never to cache:**

| Cache this | Never cache this |
|---|---|
| User profiles, settings | Financial balances, account totals |
| Product catalogue, categories | Inventory counts (stock levels) |
| Config / feature flags | Real-time prices |
| Permission / role lookups | One-time tokens, session data |
| External API responses (weather, geo) | Anything where stale = wrong business outcome |

---

### 19.5 Cause 5 — Blocking the Event Loop

Node.js runs on a single thread. Any synchronous CPU-intensive operation — large JSON transformation, cryptographic work, report generation, image processing — blocks that thread and freezes **all** concurrent requests until it finishes.

```typescript
// ❌ Synchronous CPU work blocks all other requests for 2 seconds
app.post('/report', (req, res) => {
  const result = generateHugeReport(req.body); // 2s of CPU on main thread
  res.json(result);
  // Every other user's request is completely frozen during these 2 seconds
});

// ✅ Option A — Worker Thread (CPU-bound, needs result immediately)
import { Worker, workerData, parentPort, isMainThread } from 'worker_threads';

// workers/report.worker.ts
if (!isMainThread) {
  const result = generateHugeReport(workerData);
  parentPort?.postMessage(result);
}

// In route handler
function runInWorker<T>(workerPath: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: data });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}

app.post('/report', async (req, res) => {
  const result = await runInWorker<ReportResult>('./workers/report.worker.js', req.body);
  res.json(result);
});

// ✅ Option B — Queue (CPU-bound, result not needed immediately)
import Bull from 'bull';

const reportQueue = new Bull('report-generation');

app.post('/report', async (req, res) => {
  const job = await reportQueue.add({ data: req.body });
  // Return immediately — client polls or receives webhook when ready
  res.status(202).json({ jobId: job.id, status: 'processing' });
});

reportQueue.process(async (job) => {
  return generateHugeReport(job.data.data); // runs in a separate process
});
```

**Common event-loop blockers to watch for:**

```typescript
// ❌ Synchronous file read on main thread
const data = fs.readFileSync('./large-file.json'); // blocks

// ✅ Async file read
const data = await fs.promises.readFile('./large-file.json');

// ❌ JSON.parse on very large payloads (> 1MB) — synchronous, blocks
const parsed = JSON.parse(hugeString);

// ✅ Stream large JSON with a streaming parser
import { parser } from 'stream-json';

// ❌ Synchronous crypto on main thread
const hash = crypto.createHash('sha256').update(largeBuffer).digest('hex'); // fine for small data
// For large data — use worker thread

// ❌ Tight loop without yielding
for (let i = 0; i < 10_000_000; i++) { /* ... */ } // blocks for ~100ms+

// ✅ Yield to the event loop periodically using setImmediate
async function processLargeBatch(items: unknown[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    if (i % 1000 === 0) await new Promise(resolve => setImmediate(resolve)); // yield
  }
}
```

---

### 19.6 Cause 6 — Returning Too Much Data

Fetching entire table rows when you only need 3 fields, or returning unbounded lists, wastes DB time, network bandwidth, and serialization time.

```typescript
// ❌ SELECT * — fetches all columns including large blobs, hashed passwords, etc.
const users = await db.query('SELECT * FROM users');

// ✅ Select only what you need
const users = await db.query(
  'SELECT id, email, name, created_at FROM users WHERE status = $1',
  ['ACTIVE']
);

// ❌ Unbounded — returns the entire table
const allUsers = await userRepo.findAll();

// ✅ Always paginate
async function getUsers(page: number, limit: number) {
  const safeLimit = Math.min(limit, 100); // hard cap — never more than 100
  const [users, total] = await userRepo.findAndCount({
    skip: (page - 1) * safeLimit,
    take: safeLimit,
    order: { createdAt: 'DESC' },
    select: ['id', 'email', 'name', 'createdAt'], // only needed fields
  });
  return {
    data: users,
    meta: { total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
  };
}
```

---

### 19.7 Performance Diagnosis Checklist

When an endpoint is reported as slow, run through this checklist **in order** before touching any code:

```
Step 1 — Profile first, guess never
  □ Add request timing log: log start time + duration on every request
  □ Use EXPLAIN ANALYZE on every query the slow endpoint makes
  □ Check prom metrics: is p99 slow, or just occasional spikes?

Step 2 — Most common fixes (check these first)
  □ Are there sequential awaits on independent operations? → Promise.all
  □ Does EXPLAIN ANALYZE show "Seq Scan" on a large table? → Add index
  □ Is the same query running N times in a loop? → Batch/JOIN/ORM relations

Step 3 — Caching
  □ Is the same data fetched identically on every request? → Redis cache
  □ Is an external API (geocoding, currency, weather) in the hot path? → Cache response

Step 4 — Compute
  □ Is there synchronous CPU work > ~10ms? → Worker thread or queue
  □ Is a large payload being JSON.parsed synchronously? → Streaming parser

Step 5 — Data volume
  □ Is SELECT * used anywhere? → Select only needed columns
  □ Is any query missing a LIMIT? → Add pagination with hard cap
  □ Are responses including deeply nested related objects? → Flatten or lazy-load

Step 6 — Connection pool
  □ Are DB connections being created per-request? → Use a connection pool
  □ Is the pool exhausted under load? → Increase pool size or audit slow queries
```

**The 80/20 rule for API performance:** In the vast majority of production Node.js applications, fixing **sequential awaits** (§19.1) and **missing indexes** (§19.2) alone resolves 80% of slow API complaints. Start there before any other investigation.

---

> **Maintained by:** Engineering Team  
> **Version:** 3.0.0  
> **Last Updated:** March 2026  
> **Review Cycle:** Quarterly


---

## 20. Modern Node.js & JavaScript Standards (2024–2026)

> **Why this section exists:** Node.js 22–24 and ES2024/ES2025 have made several third-party packages redundant and introduced language features that replace common boilerplate patterns. Every standard here is production-stable on **Node 24 LTS** (Active LTS since October 2025) — the minimum required runtime for all new projects.

---

### 20.1 Runtime — Always Target Node 24 LTS

| Version | Status (March 2026) | Action |
|---|---|---|
| **Node 24** | ✅ Active LTS — **use this** | All new projects |
| Node 22 | Maintenance LTS | Plan upgrade within 1 sprint |
| Node 20 | End of life | Migrate immediately |
| Node 25.x | Current (unstable) | Never in production |

Enforce the runtime version in every project:

```json
// package.json
{
  "engines": {
    "node": ">=24.0.0",
    "npm":  ">=10.0.0"
  }
}
```

```dockerfile
# Dockerfile — always pin to exact LTS
FROM node:24-alpine AS builder
```

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
```

**Rule:** `engines.node` is mandatory in `package.json`. CI and Docker must use the same version. Never run production on an end-of-life Node release.

---

### 20.2 Native TypeScript Execution

Node 22.6+ strips TypeScript types natively. Node 23.6+ does it stably — no flags, no build step in dev.

```bash
# Node 22 (experimental)
node --experimental-strip-types src/server.ts

# Node 23.6+ / Node 24 (stable — no flag)
node src/server.ts
```

**Use the right tool per environment:**

| Environment | Command | Why |
|---|---|---|
| Development | `node --watch src/server.ts` | Fast, no compile step |
| Tests | `node --test src/**/*.test.ts` | Native runner + type stripping |
| Production | `tsc && node dist/server.js` | Full type checking + optimised output |

**Hard limits — native stripping does NOT support:**

```typescript
// ❌ Decorators — require tsconfig + code generation
@injectable()
class UserService {}

// ❌ Path aliases — require tsconfig.paths
import { UserService } from '@modules/user';

// ❌ JSX
// ❌ Any tsconfig-dependent feature
```

**Rule:** Projects using decorators (NestJS, InversifyJS, TypeORM) or path aliases must keep `tsc`/`tsx` for both dev and prod. Native stripping is the default for decorator-free, alias-free backends.

```json
// package.json scripts — 2026 standard
{
  "scripts": {
    "dev":        "node --watch --env-file=.env src/server.ts",
    "test":       "node --test --env-file=.env.test src/**/*.test.ts",
    "build":      "tsc -p tsconfig.build.json",
    "start":      "node dist/server.js",
    "type-check": "tsc --noEmit"
  }
}
```

---

### 20.3 Built-in Test Runner — Drop Jest for New Projects

`node:test` is stable, fast, TypeScript-aware, and has zero dependencies. Default for new Node-only backend projects.

```typescript
// user.service.test.ts — no jest, no vitest, no extra packages
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createUserService } from './user.service.ts';
import { NotFoundError, ConflictError } from '@shared/errors/app-error.ts';

describe('UserService', () => {

  describe('register', () => {
    it('should create user and send welcome email', async (t) => {
      // Arrange
      const mockRepo = {
        findByEmail: t.mock.fn(async () => null),
        create:      t.mock.fn(async () => ({ id: '1', email: 'a@b.com', name: 'Alice' })),
      };
      const mockEmail = { sendWelcome: t.mock.fn(async () => undefined) };

      // Act
      const sut  = createUserService(mockRepo, mockEmail);
      const user = await sut.register({ email: 'a@b.com', name: 'Alice' });

      // Assert
      assert.strictEqual(user.email, 'a@b.com');
      assert.strictEqual(mockRepo.create.mock.calls.length, 1);
      assert.strictEqual(mockEmail.sendWelcome.mock.calls.length, 1);
    });

    it('should throw ConflictError when email already exists', async (t) => {
      const mockRepo = {
        findByEmail: t.mock.fn(async () => ({ id: '99', email: 'a@b.com' })),
        create:      t.mock.fn(),
      };
      const sut = createUserService(mockRepo, { sendWelcome: t.mock.fn() });

      await assert.rejects(
        () => sut.register({ email: 'a@b.com', name: 'Alice' }),
        { name: 'ConflictError' }
      );
      assert.strictEqual(mockRepo.create.mock.calls.length, 0);
    });
  });

  // Node 24 — subtests auto-awaited, no explicit await needed
  it('runs parallel utility checks cleanly', (t) => {
    t.test('paginate',  () => assert.deepStrictEqual(paginate([1,2,3,4], 2, 2), [3,4]));
    t.test('slugify',   () => assert.strictEqual(slugify('Hello World'), 'hello-world'));
  });

});
```

```json
// package.json — zero test dependencies for new projects
{
  "scripts": {
    "test":          "node --test 'src/**/*.test.ts'",
    "test:coverage": "node --test --experimental-test-coverage 'src/**/*.test.ts'",
    "test:watch":    "node --test --watch 'src/**/*.test.ts'"
  }
}
```

**Keep Jest/Vitest when:**
- Migrating a large existing Jest test suite (migration cost > benefit)
- Frontend code sharing test config with Vite
- You need snapshot testing (native runner has no snapshot support yet)

---

### 20.4 Native env File — Drop `dotenv`

Node 20.6+ loads `.env` files natively. Remove `dotenv` from all new projects.

```bash
# ❌ Old — dotenv package + code import required
# import 'dotenv/config'  ← delete this line

# ✅ Node 20.6+ — zero dependencies, zero code change
node --env-file=.env dist/server.js

# Multiple files — later file overrides earlier (local overrides)
node --env-file=.env --env-file=.env.local dist/server.js
```

**Rules:**
- Remove `dotenv` from `dependencies` in all new projects
- Keep your Zod `EnvSchema.parse(process.env)` validation — `--env-file` populates `process.env` identically
- Never commit `.env` — always commit `.env.example` with placeholder values

---

### 20.5 Runtime Permission Model

Node 24 ships a stable `--permission` model. Lock down exactly what your process can access.

```bash
# Minimal production permission set for a REST API
node \
  --permission \
  --allow-fs-read=./dist,./node_modules,./public \
  --allow-fs-write=./logs,./uploads \
  --allow-net=0.0.0.0:3000,db.internal:5432,redis.internal:6379 \
  --env-file=.env \
  dist/server.js
```

```dockerfile
# Dockerfile CMD — enforce permissions in production
CMD ["node", \
     "--permission", \
     "--allow-fs-read=./dist,./node_modules", \
     "--allow-fs-write=./logs", \
     "--allow-net", \
     "dist/server.js"]
```

```bash
# CI — audit actual permissions used by your test suite
node --permission-audit --test 'src/**/*.test.ts'
# Outputs every permission accessed — use to build your allowlist
```

| Flag | Controls |
|---|---|
| `--allow-fs-read=<paths>` | Filesystem read access |
| `--allow-fs-write=<paths>` | Filesystem write access |
| `--allow-net[=<host:port>]` | Network access |
| `--allow-env[=<vars>]` | Which env vars can be read |
| `--allow-child-process` | `child_process` spawning |
| `--allow-worker` | `worker_threads` creation |

**Rule:** Every production Dockerfile `CMD` must use `--permission` with an explicit allowlist. Unauthorised access fails at startup with `ERR_ACCESS_DENIED` — not silently at runtime under load.

---

### 20.6 Native WebSocket Client — Drop `ws` for Client Use

```typescript
// ❌ Old — ws package required
import WebSocket from 'ws';

// ✅ Node 22+ — native global, no import
const ws = new WebSocket('wss://api.example.com/stream');
ws.addEventListener('open',    ()         => ws.send(JSON.stringify({ type: 'subscribe' })));
ws.addEventListener('message', ({ data }) => processEvent(JSON.parse(data as string)));
ws.addEventListener('close',   ({ code }) => logger.info({ code }, 'WS closed'));
ws.addEventListener('error',   (err)      => logger.error({ err }, 'WS error'));

// ✅ Node 24 — WebSocketStream (Undici 7) — backpressure-aware streaming
import { WebSocketStream } from 'undici';

async function streamEvents(url: string): Promise<void> {
  const wss = new WebSocketStream(url);
  const { readable } = await wss.opened;
  for await (const message of readable) {
    await processEvent(message); // backpressure handled automatically
  }
}
```

**Rule:** Remove `ws` from projects that only use WebSocket **client** connections. Keep `ws` only if you need a WebSocket **server** — the native global is client-side only.

---

### 20.7 Built-in Watch Mode — Drop `nodemon`

```bash
# ❌ Old — nodemon devDependency
npx nodemon --watch src --ext ts --exec ts-node src/server.ts

# ✅ Node 18+ — built-in, zero dependencies
node --watch --env-file=.env src/server.ts
```

```json
{
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.ts"
  }
}
```

Remove `nodemon` and `ts-node` (if not needed for decorators) from `devDependencies`.

---

### 20.8 ES2024 / ES2025 Language Features

All stable on Node 24 LTS. Use them. Stop writing their pre-2024 equivalents.

#### `Object.groupBy()` — Replace `reduce` for Grouping

```typescript
// ❌ Old — reduce boilerplate
const byStatus = orders.reduce<Record<string, Order[]>>((acc, o) => {
  (acc[o.status] ??= []).push(o);
  return acc;
}, {});

// ✅ ES2024 — one line
const byStatus = Object.groupBy(orders, o => o.status);
// { PENDING: Order[], FULFILLED: Order[], CANCELLED: Order[] }

// Map variant — preserves insertion order, any key type
const byUser = Map.groupBy(orders, o => o.userId);
```

#### `Promise.withResolvers()` — Clean External Promise Control

```typescript
// ❌ Old — outer-scope let pollution
let resolve!: (v: string) => void;
let reject!:  (e: Error)  => void;
const p = new Promise<string>((res, rej) => { resolve = res; reject = rej; });

// ✅ ES2024
const { promise, resolve, reject } = Promise.withResolvers<string>();

// Best use: timeout wrapper — replaces any manual timeout pattern
export function withTimeout<T>(task: Promise<T>, ms: number, label = 'Operation'): Promise<T> {
  const { promise: timer, reject: cancel } = Promise.withResolvers<T>();
  const id = setTimeout(
    () => cancel(new AppError(`${label} timed out after ${ms}ms`, 408, 'TIMEOUT')),
    ms
  );
  return Promise.race([task.finally(() => clearTimeout(id)), timer]);
}

// Usage — wrap any async call that could hang
const user = await withTimeout(userRepo.findById(id), 5_000, 'DB findById');
```

#### Immutable Array Methods — Eliminate Defensive Spread Copies

```typescript
// ❌ Old — must spread to avoid mutating the original
const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
const rev    = [...items].reverse();

// ✅ ES2024 — returns new array, original always preserved
const sorted  = users.toSorted((a, b) => a.name.localeCompare(b.name));
const rev     = items.toReversed();
const updated = items.with(2, newItem);            // replace at index, immutably
const spliced = items.toSpliced(1, 1, newItem);    // non-mutating splice

// Pure pipeline — no defensive copies anywhere
function sortAndPage(items: readonly Order[], page: number, limit: number): Order[] {
  return items
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice((page - 1) * limit, page * limit);
}
```

#### Set Methods — Replace Manual Filter/Has Logic

```typescript
// ❌ Old — verbose filter combinations
const common = [...setA].filter(x => setB.has(x));
const onlyA  = [...setA].filter(x => !setB.has(x));

// ✅ ES2024 — native, readable
const adminIds  = new Set(['u1', 'u2', 'u3']);
const activeIds = new Set(['u2', 'u3', 'u4']);

adminIds.intersection(activeIds);         // Set { 'u2', 'u3' }
adminIds.union(activeIds);                // Set { 'u1', 'u2', 'u3', 'u4' }
adminIds.difference(activeIds);           // Set { 'u1' }
adminIds.symmetricDifference(activeIds);  // Set { 'u1', 'u4' }

// Permission checks become a single expression
const canAccess = (required: Set<string>, granted: Set<string>): boolean =>
  required.isSubsetOf(granted);
```

#### `using` / `await using` — Automatic Resource Cleanup

```typescript
// Implement Symbol.asyncDispose on any resource that needs cleanup
class DatabaseTransaction implements AsyncDisposable {
  private committed = false;

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
    this.committed = true;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (!this.committed) {
      await this.client.query('ROLLBACK'); // auto-rollback on any throw
    }
    this.client.release();
  }
}

class RedisLock implements AsyncDisposable {
  async [Symbol.asyncDispose](): Promise<void> {
    await redis.del(this.key);
  }
}

// Usage — no more nested try/finally for cleanup
async function transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
  await using tx   = new DatabaseTransaction(db);
  await using lock = new RedisLock(redis, `transfer:${fromId}`);

  await tx.debit(fromId, amount);
  await tx.credit(toId, amount);
  await tx.commit();
  // lock released + tx auto-rolled-back if not committed — on any throw
}
```

#### `Error.isError()` — Reliable Cross-Context Detection

```typescript
// ❌ Old — breaks across vm contexts, spoofable
if (err instanceof Error) { }

// ✅ Node 24 / ES2025 — works in vm contexts, workers, across realms
if (Error.isError(err)) {
  logger.error({ message: err.message, stack: err.stack });
}

// Update global error handler to use both
export function globalErrorHandler(err: unknown, _req: Request, res: Response): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }
  const message = Error.isError(err) ? err.message : 'Unknown error';
  logger.error({ err }, message);
  res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
}
```

#### `RegExp.escape()` — Safe Dynamic Regex From User Input

```typescript
// ❌ Old — manual escaping regex, easy to miss characters
const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ✅ Node 24 / ES2025 — built-in, always correct
const pattern = new RegExp(`^${RegExp.escape(input)}$`, 'i');

// Safe user-input search
async function searchUsers(query: string): Promise<User[]> {
  const safe = new RegExp(RegExp.escape(query.trim()), 'i');
  return (await userRepo.findAll()).filter(u => safe.test(u.name));
}
```

#### `Error({ cause })` — Preserve Full Error Chains

```typescript
// ✅ ES2022 — stable since Node 16.9, use in every catch block
try {
  await db.query('SELECT * FROM users WHERE id = $1', [id]);
} catch (dbError) {
  throw new AppError('Failed to fetch user', 500, 'DB_ERROR', { cause: dbError });
}

// AppError — forward cause to base Error
class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    options?: ErrorOptions // { cause: originalError }
  ) {
    super(message, options); // Error.cause is set automatically
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

---

### 20.9 Dependency Reduction Checklist

Node 24 makes these packages redundant for new projects. Audit and remove them.

| Remove | Replace with | Node version |
|---|---|---|
| `dotenv` | `--env-file=.env` flag | 20.6+ |
| `nodemon` | `node --watch` | 18.11+ |
| `ts-node` / `tsx` *(dev, no decorators)* | `node src/server.ts` | 22.6+ |
| `ws` *(client-only use)* | Native `WebSocket` global | 22.0+ |
| `jest` *(new projects)* | `node:test` + `node:assert` | 18.0+ stable |
| `node-fetch` / `axios` *(basic GET/POST)* | Native `fetch()` | 18.0+ |
| `uuid` *(v4 random only)* | `crypto.randomUUID()` | 14.17+ |
| `lodash.groupby` | `Object.groupBy()` | 21.0+ (ES2024) |

```bash
# Run this audit on any existing project right now
npx npm-check-updates   # shows outdated packages
npm audit               # shows vulnerable packages
npx depcheck            # shows unused packages
```

**Important:** Do not remove packages blindly. Keep packages that do significantly more than the native API — `axios` interceptors, `ws` server mode, `jest` snapshots. The table above only lists packages where the native replacement covers 100% of typical backend usage.

---

### 20.10 Updated Forbidden Patterns

Additional patterns banned as of Node 24 LTS:

| Pattern | Why banned | Replacement |
|---|---|---|
| `require('dotenv').config()` | `--env-file` is native | `node --env-file=.env` |
| `[...arr].sort()` defensive copy | Immutable methods exist | `.toSorted()` |
| `[...arr].reverse()` defensive copy | Immutable methods exist | `.toReversed()` |
| `reduce` for grouping | `Object.groupBy()` exists | `Object.groupBy()` |
| `let resolve, reject` outer scope | `Promise.withResolvers()` exists | `const { promise, resolve, reject } = Promise.withResolvers()` |
| `instanceof Error` in error handlers | `Error.isError()` is cross-context safe | `Error.isError(err)` |
| Manual regex escape strings | `RegExp.escape()` exists | `RegExp.escape(input)` |
| `nodemon` in devDependencies | `node --watch` is built-in | `node --watch` |
| `node-fetch` for basic HTTP | `fetch()` is global | Native `fetch()` |
| `crypto.randomBytes` for UUIDs | `crypto.randomUUID()` exists | `crypto.randomUUID()` |
| Running Node < 22 in production | Security vulnerabilities, no patches | Node 24 LTS |

---

## Updated Quick Reference Card

```
Runtime       → Node 24 LTS minimum. Enforce via engines.node + Dockerfile + CI
TypeScript    → node src/server.ts in dev (no flags Node 24); tsc for prod builds
Env vars      → --env-file=.env flag; remove dotenv package
Dev server    → node --watch (remove nodemon)
Testing       → node:test + node:assert for new projects (remove jest)
WebSocket     → Native WebSocket global for clients (remove ws)
Permissions   → --permission --allow-fs-read/write --allow-net in prod Dockerfile
ES2024        → Object.groupBy, Promise.withResolvers, toSorted/toReversed,
                Set methods, using/await using, Error.isError, RegExp.escape
Project       → Layered modules, separate app.ts / server.ts
SOLID         → SRP per class, DIP via interfaces, ISP with granular contracts
DI Style      → Factory functions by default; classes for errors/ORM/frameworks
Naming        → PascalCase classes, camelCase functions, SCREAMING_SNAKE constants
Errors        → Custom hierarchy, centralized handler, never expose stacks, Error.cause
Async         → Always await before return, parallel with Promise.all, withTimeout()
Security      → Zod input validation, parameterized queries, Helmet, --permission
Logging       → Structured JSON (pino), correlation IDs, never console.log
Testing       → AAA pattern, mock at interface, 80%+ coverage, node:test preferred
Docker        → Multi-stage, non-root user, node cmd, --permission flag in CMD
Git           → Conventional commits, CI gates must pass before merge
AOE / Arch    → Strict layer ordering, no circular deps, API versioned, 300-line cap
AOE / Obs     → /health endpoints, correlation IDs, Prometheus metrics, SLO contract
AOE / Evol    → Backward-compat migrations, deprecation protocol, ADRs, changelog
```

---

> **Maintained by:** Engineering Team
> **Version:** 4.0.0
> **Last Updated:** March 2026
> **Review Cycle:** Quarterly
