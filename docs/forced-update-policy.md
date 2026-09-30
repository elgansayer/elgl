# Forced update policy

Issue: #1416

## Runtime contract

The Angular shell evaluates the installed `APP_VERSION` against the operator-controlled `minimumSupported` value returned by the public `GET /api/version` endpoint.

- `APP_VERSION` remains build-generated and immutable for the deployed client.
- `MIN_SUPPORTED_VERSION` remains bundled as a conservative fallback floor.
- The backend `MINIMUM_SUPPORTED_APP_VERSION` value is authoritative when the response contains a valid semantic version.
- Versions compare using semantic-version precedence, including prerelease identifiers.
- When the installed version is older than the effective minimum, the shell renders the non-dismissible `ForcedUpdateModalComponent` before normal navigation can be used.
- The update action uses the backend release URL only when it is an absolute HTTP(S) URL. Otherwise it falls back to `https://github.com/elgansayer/elgl/releases/latest`.

The policy request is browser-only. Server-side rendering does not make an extra version-policy request.

## Failure behavior

A version-policy outage or malformed response must not brick clients that are still supported by the bundled policy. `VersionCheckService` therefore marks the remote check as failed and immediately falls back to `MIN_SUPPORTED_VERSION`.

This intentionally gives operators two layers of protection:

1. The bundled floor can block versions that were already unsupported when a build shipped.
2. The backend floor can raise the minimum later without rebuilding supported clients.

Concurrent checks are deduplicated so a single application boot cannot fan out duplicate policy requests.

## Accessibility

The forced-update surface is an `alertdialog` with an accessible title and description. Focus is trapped inside the blocking surface, Escape cannot dismiss it, body scrolling is restored to its previous value when the gate is removed, and normal keyboard activation of the update link remains available. The update action has a minimum 44px touch target and visible focus treatment.

## Security and privacy

The policy endpoint is public and contains no user-specific data, so the check does not require or send an application access token. No user content, identifiers, credentials, or tokens are logged by the client-side gate. Remote update destinations are restricted to HTTP(S), preventing an untrusted or malformed response from injecting a script/data URL into the forced navigation action.

## Verification

Run the focused frontend tests:

```bash
cd frontend
npm test -- --include src/app/services/version-check.service.spec.ts --include src/app/services/version.service.spec.ts --include src/app/components/forced-update-modal/forced-update-modal.component.spec.ts
```

The regression suite covers supported/deprecated versions, semantic-version ordering, malformed and unavailable backend policy, concurrent request deduplication, URL-scheme validation, dialog semantics, Escape suppression, keyboard activation, and body-scroll restoration.

## Rollout

1. Deploy this client while `MINIMUM_SUPPORTED_APP_VERSION` is at or below the currently supported client version.
2. Verify `GET /api/version` exposes the expected `minimumSupported` and release URL.
3. Raise `MINIMUM_SUPPORTED_APP_VERSION` only after the replacement build is published and reachable through the configured release URL.
4. Observe client/backend error telemetry for unexpected version-policy failures before increasing the floor again.

The backend and client remain mixed-version compatible: older clients continue using their bundled floor, and the new client treats an older backend that omits `minimumSupported` as a recoverable policy failure.

## Rollback and recovery

To immediately unblock remotely deprecated clients, lower `MINIMUM_SUPPORTED_APP_VERSION` to the previous supported floor; no schema migration or data rollback is required. If the new Angular behavior itself must be rolled back, revert this PR. The existing bundled minimum remains available and no persistent user data is changed by this feature.
