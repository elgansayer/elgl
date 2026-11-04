# Backend environment configuration

The NestJS API validates environment configuration before dependency injection or network clients are created. `ConfigModule.forRoot` imports `validateEnvironment` from the stable entry point at `backend/src/config/env.validation.ts`. The implementation runs raw checks first and then delegates type, range and normalisation rules to the canonical Joi schema in `backend/src/config/validation.schema.ts`. That schema is the single declaration of every variable the API recognises.

## Validation pipeline

`validateEnvironment` runs these stages in order. A failing stage stops startup, so later stages do not run until it is fixed.

1. **Development-fixture boundary.** Offline fixture modes are refused unless `NODE_ENV` is `development` or `test`.
2. **Production only (`NODE_ENV=production`).** Every variable in `PRODUCTION_REQUIRED_ENV_KEYS` must be present and non-blank, free of surrounding whitespace, and different from known development/example values.
3. **Value formats.** URL syntax and scheme, list entries and JSON documents (see below). Every malformed value is reported together in one failure so an operator fixes them in a single restart.
4. **Joi schema.** Types, numeric ranges (including TCP ports 0 to 65535), enums, minimum secret lengths, defaults and string-to-number conversion.

`ConfigModule.forRoot` is asynchronous, so a failure surfaces as a rejected promise while Nest scans the application module. Nest logs it through its `ExceptionHandler` and the process exits with code 1. `backend-container-ci.yml` relies on this: it starts the production image with only `NODE_ENV=production` and requires the output to contain `Production environment is missing required variables`, which proves the entrypoint loads and reaches the fail-closed check. Stage 2 therefore always runs before stage 3.

## Why raw validation happens before Joi defaults

Development and isolated test runs rely on harmless synthetic defaults in the Joi schema. Those defaults must never hide a missing production secret. When `NODE_ENV=production`, validation therefore inspects the raw process environment before Joi applies any default value.

Production startup fails when a required value is missing, blank, or matches a known development/example placeholder. Error messages contain environment-variable names only; they never echo credential values.

## Required production values

The required production inventory is exported through `backend/src/config/env.validation.ts` and covered by tests. It includes the core application secret, Supabase/database/Redis configuration, Centrifugo and LiveKit credentials, Cloudflare R2 and Stream credentials, translation providers, Stripe, Apple/Google billing integration, transfer signing secret, and the LLM provider key.

`backend/.env.example` is the operator-facing inventory. Production deployments should populate every required variable through the deployment secret store rather than committing a real credential to an env file.

## URL, list and JSON validation

Startup validates URL syntax and service-appropriate schemes in every environment. Only variables that are set are checked:

- frontend/app/Supabase/R2/Apple/Google audience URLs: HTTP or HTTPS;
- PostgreSQL: `postgres://` or `postgresql://`;
- Redis: `redis://` or `rediss://`;
- Centrifugo: HTTP(S) or WS(S); the optional `CENTRIFUGO_API_URL` health probe override: HTTP or HTTPS;
- LiveKit: WS or WSS;
- optional LLM `LLM_BASE_URL` and `LLM_API_URL`: HTTP or HTTPS.

List-valued variables use the same split-on-comma, trim and ignore-blank rules as the services that consume them. A malformed entry is otherwise accepted silently and only breaks something later:

- `LIVEKIT_RTC_STUN_SERVERS`: each entry is a `stun:` or `stuns:` URI with a DNS name, IPv4 address or bracketed IPv6 address and an optional port from 1 to 65535. A browser can refuse to create a peer connection when an ICE server URL is invalid, which would stop calls from joining.
- `CLOUDFLARE_R2_SOURCE_HOSTS`: each entry is a hostname or `*.hostname` with no scheme, port or path. An entry such as `https://recordings.example.com` never matches a fetched host, so every source fetch would be rejected at runtime.

`FIREBASE_SERVICE_ACCOUNT`, when set, must be a JSON object. The notifications service otherwise swallows the parse failure and quietly stops sending push notifications.

List entries and JSON documents are reported by variable name and position only (for example `CLOUDFLARE_R2_SOURCE_HOSTS entry 2`), never by value.

The Joi schema additionally enforces integer bounds, enums, secret lengths and the exact strings `true` or `false` for `TRUST_CLOUDFLARE_CONNECTING_IP` and `TRUST_CLOUDFLARE_NETWORK_METADATA`. The network abuse guard only honours the exact string `true`, so a spelling such as `TRUE` or `1` used to switch the control off without any signal.

## Blank and unset values

Optional variables follow one rule, which the example files use consistently:

| Example entry | Meaning                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `KEY=value`   | Active entry. Supply a deployment-specific value; example values fail the production check.                    |
| `KEY=`        | Optional. A blank value is accepted and leaves the integration off (for example the Datadog and mail settings). |
| `# KEY=value` | Inactive entry. Optional overrides use their default; production-only secrets must be replaced before use.      |

`LLM_MODEL` and `LLM_API_URL` are in the third group because their consumers apply defaults with `??` or a default parameter, which only covers an unset variable. A blank value would be sent to the provider as the model name or endpoint.

## Environment example files

Two files document the same application variables:

- `backend/.env.example` for running the API on its own;
- `.env.example` at the repository root, used by `cp .env.example .env` for Docker Compose. It mirrors the backend file, adds the variables that the compose files interpolate (`CENTRIFUGO_ALLOWED_ORIGINS`, `GRAFANA_*`, `PROMETHEUS_*`, `DD_SITE`, `DD_HOSTNAME`, `APP_VERSION`) and then holds the unrelated OpenHands Factory settings.

Copying either file to `.env` produces a configuration that boots in development. In production it is refused because it still contains example values, which is deliberate: an example must never be deployable as written.

Production-only Compose credentials such as `GRAFANA_ADMIN_PASSWORD` remain commented out. This preserves their documentation without letting a copied example satisfy Compose's required-secret check with a known example value.

`backend/src/config/env-example.contract.spec.ts` keeps the files honest. It fails the build when:

- a schema variable is not documented in an example, or an example documents a variable the application does not recognise;
- production code reads a variable (through `process.env` or `ConfigService.get`) that the schema does not declare;
- a variable that a compose file interpolates is missing from the root example, or the root example documents anything the backend example and the compose files do not explain;
- an example does not boot through the real `ConfigModule` loader in development, or is accepted in production while it still holds example values;
- a production-required variable has no value in an example.

The scanner only sees string-literal reads. A helper that wraps `get(key)` with a variable key must still declare its variables in the schema by convention.

### Intentional exemptions

- `LIVEKIT_TURN_USERNAME` and `LIVEKIT_TURN_PASSWORD` are in the schema with development-only defaults but are deliberately absent from the examples. `scripts/verify-livekit-turn-networking.mjs` forbids documenting static TURN credentials because LiveKit's embedded TURN server issues short-lived ones (see [LiveKit STUN/TURN production networking](livekit-turn-networking.md)).

  Note that the API's `LivekitService.buildIceServers` still requires those static credentials whenever `LIVEKIT_TURN_ENABLED=true` and rejects the development defaults in production. A production deployment that follows the embedded-TURN setup, with `LIVEKIT_TURN_ENABLED=true` reaching the API container through `env_file`, therefore passes startup validation and then fails when a LiveKit token is requested. This is a LiveKit design gap that environment validation cannot resolve on its own; it needs a decision on how the API should hand out embedded TURN credentials.

## Adding or changing a variable

1. Read it through `ConfigService` (preferred) or `process.env`, and declare it in `backend/src/config/validation.schema.ts`. Choose the strictest type and range that is still correct, and decide deliberately whether blank means unset.
2. If it is a URL, add it to `URL_REQUIREMENTS` in the validation implementation; if it is a comma-separated list or JSON document, add it to `LIST_REQUIREMENTS` or `JSON_OBJECT_KEYS`.
3. If a deployment cannot work without it, add it to `PRODUCTION_REQUIRED_ENV_KEYS` and note the rollout in the pull request, because existing production environments will then fail to start until it is set.
4. Document it in `backend/.env.example` and `.env.example` using the entry style above, and in any compose file that passes it through.
5. Run `npx vitest run src/config` from `backend/`.

## Failure and observability contract

Configuration errors are fatal and occur during application bootstrap, before the HTTP server listens. This intentionally prevents the API from serving traffic with synthetic credentials or partially initialised providers. The error lists only missing/invalid variable names and validation rules, making deployment logs actionable without exposing secret values. The process exits with a non-zero status, so orchestrators and `docker compose` report the container as failed and the health check never passes.

There is no runtime fallback from an invalid production environment. Fix the deployment secret/configuration and restart the process.

## Development and tests

Development and test environments retain the Joi defaults so unit tests and local feature work do not require every external SaaS credential. Any explicitly supplied URL, list or JSON value is still validated, preventing malformed local configuration from silently reaching a client library.

`TRANSFER_SECRET` remains required by the canonical Joi schema in every environment.

## Rollout

1. Compare the target deployment's secret/config store with `PRODUCTION_REQUIRED_ENV_KEYS` and `backend/.env.example`.
2. Replace example, `test-*`, `change-me*`, `replace-with*`, and Stripe test placeholders with production values.
3. Check the values that are newly validated. These can stop a previously starting instance, so look for them before deploying:
   - `TRUST_CLOUDFLARE_CONNECTING_IP` and `TRUST_CLOUDFLARE_NETWORK_METADATA` must be exactly `true` or `false`;
   - `PORT`, `MAIL_PORT`, `LIVEKIT_TURN_TLS_PORT`, `LIVEKIT_TURN_UDP_PORT` and `DD_DOGSTATSD_PORT` must be TCP/UDP ports from 0 to 65535;
   - `LIVEKIT_RTC_STUN_SERVERS` and `CLOUDFLARE_R2_SOURCE_HOSTS` entries must match the formats above;
   - `FIREBASE_SERVICE_ACCOUNT`, when set, must be a JSON object;
   - `CENTRIFUGO_API_URL` and `LLM_API_URL`, when set, must be HTTP(S) URLs, and `LLM_API_URL` must not be blank.
4. Deploy the backend. A configuration error will stop startup before the instance becomes healthy.
5. Verify health checks and provider-specific smoke tests after the process starts.

The audio room health probe now checks `CENTRIFUGO_URL` unless `CENTRIFUGO_API_URL` overrides it. Previously it fell back to `http://localhost:8000`, which reported Centrifugo as down whenever it ran in another container.

No database migration or persisted-data transformation is involved.

## Rollback

Revert the application commit if an emergency rollback is required. Do not restore test/default credentials to a production secret store. A rollback only changes startup validation and the health probe target; it does not alter persisted data, API payloads, authentication state, or database schema.
