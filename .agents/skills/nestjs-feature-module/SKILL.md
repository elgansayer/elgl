---
name: nestjs-feature-module
description: 'Scaffold a new NestJS backend module in backend/src (controller, service, DTOs, module wiring, Vitest specs). Use when adding a new API resource, endpoint group, or backend feature area to the HelloTalk NestJS API.'
---

# NestJS Feature Module

## When to Use

- Adding a brand-new backend feature area (its own folder under `backend/src/<feature>/`).
- Adding endpoints to an existing module that needs new DTOs/service methods/tests.

## Reference Layout

Every existing module (`chat`, `discovery`, `economy`, `monetisation`, `audio-rooms`, `moments`, `flashcards`, `safety`, `nlp`, `profile-visits`, `media`, `users`) follows this shape:

```
backend/src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.controller.spec.ts
  <feature>.service.ts
  <feature>.service.spec.ts
  dto/
    <action>.dto.ts
  interfaces/
    <feature>.interface.ts   (row/response shapes, optional)
```

## Procedure

1. **Module file** - wire controller/service and export the service if other modules need it:

   ```ts
   @Module({
     controllers: [FeatureController],
     providers: [FeatureService],
     exports: [FeatureService],
   })
   export class FeatureModule {}
   ```

   Register the new module in `backend/src/app.module.ts`.

2. **DTOs** - one class per request shape in `dto/`, validated with `class-validator` decorators (`@IsString`, `@IsIn`, `@IsInt`, `@IsPositive`, `@IsOptional`). Never trust a client-supplied amount/balance/status field that has financial or privilege implications - see the `payment-webhook-security` skill.

3. **Controller** - guard every endpoint that reads/writes user data with `@UseGuards(SupabaseAuthGuard)` and pull the caller via `@CurrentUser() user: User | null` (`backend/src/auth/current-user.decorator.ts`). Always null-check `user` before use:

   ```ts
   @Post()
   @UseGuards(SupabaseAuthGuard)
   async create(@CurrentUser() user: User | null, @Body() dto: CreateXDto) {
     if (!user) return null;
     return await this.service.create(user.id, dto);
   }
   ```

   Public/unauthenticated endpoints (like inbound webhooks) must independently verify the caller (signature, secret) inside the service - never rely on `@UseGuards` alone for those.

4. **Service** - inject `SupabaseService` (`backend/src/supabase/supabase.service.ts`) for `getClient()` (Postgres/Auth) and `getRedisClient()` (rate limits/queues/cache). Throw NestJS HTTP exceptions (`BadRequestException`, `ForbiddenException`, `NotFoundException`) for expected failure paths rather than returning ambiguous nulls.

5. **Tests** - add a `*.spec.ts` next to every controller/service (Vitest, mocking `SupabaseService`/`CentrifugoService`/`ConfigService` as needed). Per `AGENTS.md` Section 7, every controller/service/guard must have coverage for DTO validation, auth flows, and external-service mocks.

6. **Verify** - run the `verification-gate` skill's backend steps (`npm run lint`, `npm test`, `npm run build` inside `backend/`) before considering the module done.

## Gotchas Found in This Codebase

- Endpoints with money/coin/VIP-tier side effects must derive the amount/tier from a server-verified source, never from the request body. This exact mistake exists today in `economy.service.ts#purchaseCoins` and `monetisation.service.ts#upgradeUser` - do not copy that pattern (see `payment-webhook-security`).
- `CentrifugoService.publish(channel, data)` swallows errors and returns `boolean` - check the return value if delivery matters for the feature.

---

name: nestjs-feature-module
description: 'Scaffold a new NestJS backend feature module in backend/src (controller, service, DTOs, module wiring, Vitest specs). Use when adding a new REST resource, API endpoint, background worker, or backend capability to the HelloTalk clone (e.g. a new "flashcards", "safety", "economy"-style module).'
---

# NestJS Feature Module

## When to Use

- Adding a brand-new backend domain (new folder under `backend/src/<feature>/`).
- Adding new endpoints to an existing module that need a new DTO + service method.

## File Layout (mirror existing modules exactly)

```
backend/src/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.controller.spec.ts
├── <feature>.service.ts
├── <feature>.service.spec.ts
├── dto/
│   └── <action>.dto.ts
└── interfaces/          # only if the module needs shared row/result types
    └── <feature>.interface.ts
```

## Procedure

1. **Module wiring** - keep it minimal, no business logic in the module file:

   ```typescript
   @Module({
     controllers: [FeatureController],
     providers: [FeatureService],
     exports: [FeatureService], // only export what other modules actually consume
   })
   export class FeatureModule {}
   ```

   Register the new module in `backend/src/app.module.ts`.

2. **DTOs** - one class per request shape, validated with `class-validator` decorators (`@IsString`, `@IsNotEmpty`, `@IsIn`, `@IsInt`, `@IsPositive`, `@IsOptional`). Never accept an untyped `Body()`. Every numeric/monetary/quantity field a client can set must have an explicit validator - do not trust bare `number` types.

3. **Auth guard on every endpoint that touches user data:**

   ```typescript
   @Post('some-action')
   @UseGuards(SupabaseAuthGuard)
   async someAction(@CurrentUser() user: User | null, @Body() dto: SomeDto) {
     if (!user) return null;
     return await this.featureService.someAction(user.id, dto);
   }
   ```

   `SupabaseAuthGuard` (`backend/src/auth/supabase-auth.guard.ts`) validates the Supabase JWT for both `http` and `ws` execution contexts and attaches `user` to the request/socket. `CurrentUser` (`backend/src/auth/current-user.decorator.ts`) reads it back out. Public/webhook endpoints are the only exception - and those need their own signature/authenticity verification instead (see the `payment-webhook-security` skill).

4. **Service pattern** - inject `SupabaseService` and call `this.supabaseService.getClient()` per method (do not cache the client on `this` across requests). Use `NotFoundException`, `BadRequestException`, `ForbiddenException` from `@nestjs/common` for expected failure paths; throw plain `Error` only for truly unexpected states. Never build a raw SQL string by concatenating user input - always use the Supabase query builder (`.eq()`, `.contains()`, `.gt()`, etc.) or a Postgres RPC function (see `discovery.service.ts#searchPartners` calling `supabase.rpc('search_nearby_users', {...})` for the PostGIS pattern).

5. **Money/quantity fields are server-authoritative.** If an endpoint changes `coins_balance`, `is_vip`, `vip_tier`, or anything else with real-world value, the amount/tier must be derived from a verified payment record on the server, never accepted as-is from the request body. See `payment-webhook-security` skill - this is a documented critical gap in this codebase (`AGENTS.md` Section 8.1).

6. **Tests** - every controller and service needs a `*.spec.ts` using `@nestjs/testing`'s `Test.createTestingModule`, mocking `SupabaseService`/`ConfigService`/other collaborators. Cover: happy path, the guard rejecting an unauthenticated request, and at least one validation/error path (`NotFoundException`, `BadRequestException`, etc.).

## Verification

Run the `verification-gate` skill's backend steps before considering the module done: `cd backend && npm run build && npm run lint && npm test`.
