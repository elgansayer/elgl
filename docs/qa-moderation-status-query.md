# Moderation status query build regression

Issue #934 tracked an E2E startup timeout whose root cause was an Angular TypeScript compile failure in `ModerationService`: the optional moderation `status` query parameter was written through dot notation on a `Record<string, string>` while `noPropertyAccessFromIndexSignature` was enabled.

## Production contract

`ModerationService.getItems()` now builds request query parameters with Angular `HttpParams` instead of mutating a generic string record. The required moderation `type` is always present. A status filter is trimmed and included only when it contains a non-whitespace value.

This keeps the query construction typed and removes the index-signature access pattern that caused the Angular dev server to fail compilation. The API contract remains unchanged: `GET /moderation/items?type=<moment|profile>&status=<status>`.

## Failure handling and privacy

The change does not alter moderation authorization, response data, retry behavior, or fallback behavior. Authentication continues to use the existing bearer header. No moderation content, user identifiers, tokens, or provider errors are added to logs.

## Verification

The focused `ModerationService` Vitest suite verifies:

- the required `type` query parameter;
- normalized optional `status` query parameters;
- omission of missing or whitespace-only status filters;
- existing authentication headers and fallback behavior.

Repository CI remains authoritative for Angular static analysis, production build, unit tests, and Playwright startup. A production Angular build should fail immediately on any future TypeScript regression rather than surfacing later as a Playwright web-server timeout.

## Rollout and rollback

No schema, API, persistence, or deployment-order change is required. Deploy through the normal frontend pipeline. Rollback is a standard revert of this change; no stored data is affected.
