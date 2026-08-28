# OpenAPI-driven mock response factories

Issue: #7937 (MB-004)

## Purpose

The offline/mock backend can create deterministic response payloads directly from the same OpenAPI document served by NestJS Swagger. This removes a class of hand-maintained fixtures that silently drift when a response DTO changes.

The facility is test infrastructure, not an application dependency fallback. It is reachable only when the existing explicit `MOCK_BACKEND_MODE=local|test|demo` boundary is enabled in a development/test runtime. Outside that boundary the routes return `404`.

## Authoritative factory catalogue

When mock mode is enabled, bootstrap builds the Swagger document once and registers it with `OpenApiFixtureFactoryRegistry`. The registry discovers every documented `2xx` response that has an `application/json` or `+json` schema. `204`/schema-less responses are intentionally omitted because there is no response DTO to manufacture.

List the available factories:

```http
GET /api/mock/schema-fixtures/responses
```

Each descriptor is keyed by HTTP method, OpenAPI path template and success status, for example `GET /version 200`. The catalogue is derived from `paths.*.*.responses`, so adding/removing a documented public response changes the catalogue without a second hand-maintained registry.

## Create a deterministic response

```http
POST /api/mock/schema-fixtures/responses
Content-Type: application/json

{
  "method": "get",
  "path": "/version",
  "status": "200",
  "seed": 7937,
  "overrides": {
    "minimumSupportedVersion": "2.0.0"
  }
}
```

The generator uses `DeterministicFixtureGenerator`, therefore the same OpenAPI schema + seed + overrides produces the same payload. UUIDs, timestamps, numbers and strings are generated without wall-clock time or `Math.random()`. URI fields are rooted at `http://127.0.0.1/mock-fixtures/...`, so schema fixtures do not introduce third-party network dependencies.

Overrides are deep-merged for object responses and then validated against the authoritative response schema. Invalid overrides fail rather than creating a payload that the real API contract would reject.

## Validate the whole public response catalogue

```http
POST /api/mock/schema-fixtures/responses/validate-all
```

This generates and validates a default for every discovered public JSON success response. It is useful after DTO/OpenAPI changes because unsupported schema constraints fail at the contract boundary instead of silently producing invalid fixture data.

The schema engine supports `$ref`, JSON-pointer response references, objects, arrays, enums, `allOf`, `oneOf`, `anyOf`, primitives, common OpenAPI string formats, bounds, required fields, additional-property policies and string patterns. Unsupported/contradictory constraints fail explicitly.

## Compile-time DTO factories

For code that needs a named DTO-specific fixture, use `defineTypedFixtureFactory<T>()`:

```ts
interface ProfileResponse {
  id: string;
  displayName: string;
  bio?: string;
}

const profileFactory = defineTypedFixtureFactory<ProfileResponse>({
  id: 'fixture-id',
  displayName: 'Fixture learner',
});
```

Because the defaults argument is `T`, adding a new required field to `ProfileResponse` makes the fixture definition fail TypeScript compilation until the required default is supplied. Optional fields remain optional. The generic OpenAPI registry remains the coverage mechanism for every documented public response, while typed named factories provide compile-time drift protection where tests need domain-specific defaults.

## Frontend integration

`MockSchemaFixtureClient` is a small test/manual-QA client that uses the runtime `ConfigurationService`. It refuses to make a network request unless the client itself is in an explicit mock profile. Frontend integration coverage consumes both the response-factory index and generated payload endpoint, so the browser-side test boundary is exercised rather than importing backend fixture objects directly.

## Parallelism and reset behavior

Factories are stateless. Every creation request instantiates a fresh deterministic generator from its explicit/default seed, so parallel workers do not share PRNG state and there is nothing to reset. Scenario state introduced by other mock-backend issues can layer namespace/reset behavior on top without changing schema-factory determinism.

## Security and privacy

- The controller is excluded from Swagger so it cannot recursively become part of its own public-response catalogue.
- Production/provision runtimes cannot enable mock mode through the existing startup guard.
- Requests are bounded and globally throttled; method/path/status must match a documented success response exactly.
- External OpenAPI `$ref` values are rejected; only local `#/...` references are followed.
- Generated URL fields use loopback-owned fixture URLs rather than remote media.
- Responses use `Cache-Control: no-store, private`.
- Fixture diagnostics contain only deterministic non-secret seed identifiers.
- The generator never reads production rows, tokens, credentials or private user content.

## Verification

Focused backend tests cover public-response discovery, deterministic replay, schema validation, nested overrides, invalid contract rejection, whole-catalogue validation and compile-time required-field drift. Frontend tests verify the explicit mock boundary and consume generated fixtures through HTTP.

Recommended checks:

```bash
npm --prefix backend test -- --runInBand src/mock/openapi-fixture-factory.spec.ts
npm --prefix frontend test -- --run src/app/core/testing/mock-schema-fixture.client.spec.ts
npm --prefix backend run build
npm --prefix frontend run build
```

GitHub Actions remains the authoritative clean-environment verification for a pull-request head.

## Rollout and rollback

Roll out only after the #7932 mock-backend activation boundary is present. No migration or production data change is required. Existing hand-authored scenarios can move to these factories incrementally; no production endpoint behavior changes.

Rollback is code-only: remove the schema-fixture controller/registry/client together and restore lazy-only Swagger document construction. Dependent mock scenarios must stop calling the schema-fixture endpoints before rollback. Never roll back only the production activation guard while leaving these routes enabled.
