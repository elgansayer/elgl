# NestJS backend bootstrap contract

Issue #1279 originally requested initialising the `backend/` package with the Nest CLI and npm. The repository has since evolved into a large production NestJS application, so regenerating the directory with `nest new` would destroy working feature modules and configuration. The durable requirement is that the existing backend continues to satisfy the NestJS/npm bootstrap contract.

## Canonical package boundary

`backend/` is the only NestJS API package. It remains a private npm package with an npm lockfile and a declared npm package manager. The application uses the standard NestJS runtime packages and keeps the Nest CLI, schematics and testing utilities as development dependencies.

The Nest CLI configuration keeps `src` as the source root and clears the build output before compilation. The production entry point remains `dist/main`, built from `src/main.ts`.

## Bootstrap ownership

`src/main.ts` is the application bootstrap boundary. It creates `AppModule` through `NestFactory`, configures the application-level HTTP concerns, and listens on the configured `PORT` with the existing 3000 fallback.

Feature modules belong under the existing `AppModule` graph. Do not run `nest new backend` over the current directory or create a second generated NestJS application alongside it.

## Commands

Run backend commands from `backend/`:

```bash
npm ci
npm run lint:check
npm run build
npm test
npm run test:e2e
```

The repository CI remains authoritative for clean-environment validation.

## Regression guard

`backend/src/backend-bootstrap-contract.spec.ts` verifies the durable initialisation contract without pinning feature-specific implementation details. It checks:

- the package is private and npm-managed;
- the required NestJS runtime and development packages remain declared;
- the Nest CLI source-root/build-output configuration remains intact;
- build, development, production, lint and test entry points remain available;
- `package-lock.json` remains present;
- `src/main.ts` still boots `AppModule` through `NestFactory` and listens on the configured port;
- the test is rooted in the existing `backend/` package, preventing a generated sibling backend from silently becoming the new application.

## Security and operations

This contract does not weaken or replace current application security. Authentication, CORS, validation, raw-body handling, security headers and feature-specific controls remain owned by the current bootstrap and feature modules. The contract intentionally avoids asserting transient feature configuration so those controls can evolve independently.

No database, API, persisted-state or deployment migration is introduced by this issue-completion change.

## Rollback

The completion change is test and documentation only. Rollback is a normal revert of the regression test and this document. Do not roll back by regenerating the backend or replacing the current application with a fresh NestJS scaffold.
