# Backend environment configuration

The NestJS API validates environment configuration before dependency injection or network clients are created. `ConfigModule` calls `validateEnvironment`, which performs raw production checks first and then delegates type/range validation to the canonical Joi schema in `backend/src/config/validation.schema.ts`.

## Why raw validation happens before Joi defaults

Development and isolated test runs historically rely on harmless synthetic defaults in the Joi schema. Those defaults must never hide a missing production secret. When `NODE_ENV=production`, validation therefore inspects the raw process environment before Joi applies any default value.

Production startup fails when a required value is missing, blank, or matches a known development/example placeholder. Error messages contain environment-variable names only; they never echo credential values.

## Required production values

The required production inventory is exported as `PRODUCTION_REQUIRED_ENV_KEYS` from `backend/src/config/environment.validation.ts` and covered by tests. It includes the core application secret, Supabase/database/Redis configuration, Centrifugo and LiveKit credentials, Cloudflare R2 and Stream credentials, translation providers, Stripe, Apple/Google billing integration, transfer signing secret, and the LLM provider key.

`backend/.env.example` is the operator-facing inventory. Values that are explicitly optional in the Joi schema may remain empty. Production deployments should populate every required variable through the deployment secret store rather than committing a real credential to an env file.

## URL and scheme validation

Startup validates both URL syntax and service-appropriate schemes before boot:

- frontend/app/Supabase/R2/Apple/Google audience URLs: HTTP or HTTPS;
- PostgreSQL: `postgres://` or `postgresql://`;
- Redis: `redis://` or `rediss://`;
- Centrifugo: HTTP(S) or WS(S);
- LiveKit: WS or WSS;
- optional LLM base URL: HTTP or HTTPS.

The Joi schema still performs its existing integer bounds, enums, secret-length checks, and other normalization after these raw checks.

## Failure and observability contract

Configuration errors are fatal and occur synchronously during application bootstrap. This intentionally prevents the API from serving traffic with synthetic credentials or partially initialized providers. The thrown error lists only missing/invalid variable names and validation rules, making deployment logs actionable without exposing secret values.

There is no runtime fallback from an invalid production environment. Fix the deployment secret/configuration and restart the process.

## Development and tests

Development and test environments retain the existing Joi defaults so unit tests and local feature work do not require every external SaaS credential. Any explicitly supplied URL is still scheme-validated, preventing malformed local configuration from silently reaching a client library.

`TRANSFER_SECRET` remains required by the canonical Joi schema in every environment, matching the existing behavior.

## Rollout

1. Compare the target deployment's secret/config store with `PRODUCTION_REQUIRED_ENV_KEYS` and `backend/.env.example`.
2. Replace example, `test-*`, `change-me*`, `replace-with*`, and Stripe test placeholders with production values.
3. Deploy the backend. A configuration error will stop startup before the instance becomes healthy.
4. Verify health checks and provider-specific smoke tests after the process starts.

No database migration or persisted-data transformation is involved.

## Rollback

Revert the application commit if an emergency rollback is required. Do not restore test/default credentials to a production secret store. A rollback only changes startup validation; it does not alter persisted data, API payloads, authentication state, or database schema.
