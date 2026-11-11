# Client version enforcement

Issue: #2031 (Version Enforcer API)

The version policy was advisory: `GET /api/version` published `minimumSupported` and the Angular shell chose to show a blocking update dialog. The server never refused an outdated client. This change makes the NestJS API enforce the same operator-controlled floor.

## Contract

First-party clients declare their build version in the `X-App-Version` request header. The Angular `clientVersionInterceptor` adds it to every request addressed to `environment.apiUrl` (and only to those: third-party hosts and lookalike prefixes never receive it).

A global `ClientVersionGuard` evaluates the header against `MINIMUM_SUPPORTED_APP_VERSION` using semantic-version precedence (prereleases sort below their release, build metadata is ignored, a leading `v` is accepted).

| Declared version | Result |
| --- | --- |
| At or above the minimum | Request proceeds |
| Below the minimum | `426 Upgrade Required` with `Cache-Control: no-store` |
| Header missing, blank or not a semantic version | Request proceeds (fail open) |

The rejection body is public policy data only; the client-supplied value is never echoed back:

```json
{
  "statusCode": 426,
  "error": "Upgrade Required",
  "code": "CLIENT_UPGRADE_REQUIRED",
  "message": "This version of the app is no longer supported. Update to continue.",
  "minimumSupported": "2.4.1",
  "updateUrl": "https://github.com/example/releases/tag/v2.5.0"
}
```

`GET /api/version/check` is a handshake that answers `200` with `status` set to `supported`, `update_available`, `upgrade_required` or `unknown` for the version in the same header. It applies the same evaluation as the guard without failing the call, so native shells and operators can ask "what would the server do for build X" (`curl -H 'X-App-Version: 1.2.3' .../api/version/check`).

### Why it fails open

The header is declared by the client, so it can be omitted or forged. The gate is a compatibility control for builds that identify themselves, not an authentication boundary. Webhooks, health probes, server-to-server callers and builds that predate the header are therefore never blocked. Authorisation continues to rely on the existing guards.

### Exempt routes

`@AllowOutdatedClient()` exempts a route or controller from the check. `VersionController` carries it so a blocked client can always read the policy that blocks it. Add the decorator to any future endpoint an outdated client must reach in order to update.

## Client behaviour

`VersionService.applyUpgradeRequired()` accepts the 426 body, validates `minimumSupported` as a semantic version and `updateUrl` as an HTTPS URL, then opens the existing non-dismissible `ForcedUpdateModalComponent`. The failed request is rethrown to its caller. A 426 without `code: "CLIENT_UPGRADE_REQUIRED"` (for example a genuine protocol upgrade from an intermediary) is ignored. The next `checkVersion()` recomputes the state from the policy, so lowering the floor releases clients without a reload.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `MINIMUM_SUPPORTED_APP_VERSION` | `1.0.0` | Stable `major.minor.patch` floor (unchanged). |
| `CLIENT_VERSION_ENFORCEMENT` | `enforce` | `enforce` rejects with 426. `report-only` records the decision in metrics and allows the request. `off` skips the check entirely. |

A malformed `CLIENT_VERSION_ENFORCEMENT` stops service construction, like a malformed minimum, rather than silently choosing a policy.

## Observability

`hellotalk_client_version_checks_total{outcome}` counts decisions with a closed label set: `missing`, `invalid`, `supported`, `upgrade_required`, `report_only`. Raw version strings never become labels. A rising `missing` share during rollout shows clients that do not yet send the header; a rising `upgrade_required` share shows how many users a floor change would strand. Per-request logs are `debug` level to keep a retrying outdated client from flooding warnings.

## Rollout

1. Deploy the backend with `CLIENT_VERSION_ENFORCEMENT=report-only` and watch `report_only` against the expected count of stranded clients.
2. Deploy the Angular client so supported builds start sending `X-App-Version`.
3. Publish the replacement build, then raise `MINIMUM_SUPPORTED_APP_VERSION`.
4. Switch to `enforce`.

## Rollback

Set `CLIENT_VERSION_ENFORCEMENT=off`, or lower `MINIMUM_SUPPORTED_APP_VERSION`, and roll the backend. No schema, queue or persisted data is involved. Clients that already showed the modal clear it on their next policy refresh.

## Verification

- `backend/src/version/semantic-version.spec.ts`: precedence rules and malformed input.
- `backend/src/version/version.service.spec.ts`: enforcement-mode parsing and `evaluateClientVersion`.
- `backend/src/version/client-version.guard.spec.ts`: 426 body, fail-open cases, exemption, report-only and off modes, metrics.
- `backend/src/version/version.controller.spec.ts`: handshake route and class-level exemption.
- `backend/test/client-version.e2e-spec.ts`: the real HTTP pipeline, including the `Cache-Control` header and exempt policy routes.
- `frontend/src/app/interceptors/client-version.interceptor.spec.ts` and `frontend/src/app/services/version.service.spec.ts`: header scope, 426 handling and recovery.
