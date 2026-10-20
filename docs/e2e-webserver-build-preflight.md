# E2E frontend web-server build preflight

Issue #1556 tracked a recurring Playwright failure that surfaced as `Timed out waiting 300000ms from config.webServer` even when the real failure was an Angular/TypeScript compilation error. `ng serve` can remain alive after a failed compilation, so Playwright only sees an unavailable URL and waits for the full server timeout.

## Runtime contract

The Playwright frontend web-server command must run the production Angular build before starting the development server:

```text
cd ../frontend && npm run build && npm run start -- --host 127.0.0.1
```

The shell `&&` is intentional. A TypeScript/template/build failure now terminates the web-server command immediately and GitHub Actions reports the compiler diagnostics directly instead of spending up to five minutes waiting for port 4200.

The backend already follows the same fail-fast pattern by building before starting `dist/main`.

## Verification

`npm run check:e2e-webserver-preflight` locks the Playwright configuration contract. It is also part of the root `npm run verify` pipeline. The normal frontend production build remains the authoritative compile check.

## Failure handling and observability

A failing Angular build is not retried or hidden by the E2E harness. The build process exits non-zero and its diagnostics remain in the workflow log. No request bodies, user data, credentials, or test-account secrets are added to logging by this change.

Once the preflight succeeds, Playwright retains its existing 300-second startup allowance for the dev server itself. This keeps slow CI runners supported without masking compiler failures.

## Rollout and rollback

No schema, API, runtime-user, or persisted-data migration is involved. The change only affects Playwright-managed E2E server startup. Roll back by reverting the Playwright command and contract test; production deployments are unaffected.
