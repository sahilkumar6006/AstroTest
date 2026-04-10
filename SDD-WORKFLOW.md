# SDD Workflow Guide — AstroTalk Backend

## How to Work with This Project Using Spec-Driven Development

---

## The Golden Rule

> **Spec first. Always. No exceptions.**
>
> Before writing a single line of code for a feature, the spec file must exist and be reviewed.

---

## Step-by-Step Workflow for Every Feature

```
1. SPEC   → Write or update the .spec.md file
2. REVIEW → Read the spec, check for gaps, confirm with stakeholders
3. SCHEMA → Update prisma/schema.prisma if DB changes needed
4. ZOD    → Write Zod validation schemas (auth.schema.js)
5. REPO   → Write repository layer (DB queries only)
6. SERVICE→ Write service layer (business logic, calls repository)
7. CTRL   → Write controller (calls service, sends response)
8. ROUTES → Wire up routes with auth middleware + Zod validation
9. TEST   → Write tests for every test case listed in the spec
10. DOCS  → openapi.yaml auto-generated or manually updated
```

---

## How to Prompt Claude for Code Generation

Always include both files when asking Claude to generate code:

### Template Prompt
```
Context (PROJECT.md):
[paste the full PROJECT.md here]

Feature Spec:
[paste the relevant .spec.md here]

Task:
Generate the [repository / service / controller / schema / routes]
for the [module name] module following the conventions in PROJECT.md.
```

### Example Prompt — Generate Auth Service
```
Context: [paste PROJECT.md]
Spec: [paste specs/auth.spec.md]

Task:
Generate auth.service.js for the auth module.
- Use AppError for all errors
- Follow the repository pattern (no Prisma calls in service)
- Implement: sendOtp(), verifyOtp(), refreshToken(), logout()
- Use bcrypt for OTP hashing, crypto for refresh token generation
```

---

## File Generation Order (Per Module)

```
1. module.schema.js     ← Zod schemas from spec
2. module.repository.js ← Prisma queries only
3. module.service.js    ← Business logic
4. module.controller.js ← Request/response
5. module.routes.js     ← Express router
6. module.test.js       ← Tests from spec test cases table
```

---

## When the Spec Changes

1. Update the `.spec.md` file first
2. If DB changes → update `schema.prisma` → run `prisma migrate dev`
3. Update Zod schema if request/response shape changes
4. Update service/repository as needed
5. Update tests
6. Never change code to "match what the code does" — always change code to match the spec

---

## Spec Completeness Checklist

Before considering a spec "ready to code", verify:

- [ ] All endpoints have method + path defined
- [ ] All request bodies documented with types
- [ ] All success responses documented with exact shape
- [ ] All error cases listed with status + code
- [ ] Business rules are explicit (no ambiguity)
- [ ] DB schema changes documented
- [ ] Zod schemas written
- [ ] Test cases table filled

---

## Project Spec Files

| File                                    | Status      |
|-----------------------------------------|-------------|
| PROJECT.md                              | ✅ Complete |
| specs/auth.spec.md                      | ✅ Complete |
| specs/users.spec.md                     | ✅ Complete |
| specs/astrologers.spec.md               | ✅ Complete |
| specs/sessions-payments-reviews.spec.md | ✅ Complete |
| specs/chat.spec.md                      | 🔲 TODO     |
| specs/calls.spec.md                     | 🔲 TODO     |
| specs/horoscope.spec.md                 | 🔲 TODO     |
| specs/notifications.spec.md             | 🔲 TODO     |
| specs/admin.spec.md                     | 🔲 TODO     |
| prisma/schema.prisma                    | ✅ Complete |
| openapi.yaml                            | 🔲 TODO     |

---

## Naming Conventions (Quick Reference)

| Thing              | Convention        | Example                  |
|--------------------|-------------------|--------------------------|
| Files              | camelCase         | `authService.js`         |
| DB tables          | snake_case plural | `refresh_tokens`         |
| DB columns         | camelCase         | `walletBalance`          |
| API paths          | kebab-case        | `/send-otp`              |
| Error codes        | UPPER_SNAKE       | `OTP_INVALID`            |
| Socket events      | `domain:action`   | `session:requested`      |
| Redis keys         | `domain:type:id`  | `otp:+919876543210`      |
| Env variables      | UPPER_SNAKE       | `JWT_ACCESS_SECRET`      |
