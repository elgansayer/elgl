# Profile visit tracking

Profile visits are recorded when an authenticated user successfully opens another user's profile through `GET /users/:id`. The tracking path is deliberately secondary to the profile read: unavailable privacy state or persistence failure does not fabricate data and does not make the profile itself unavailable.

## Privacy and authorization

- Self views are never recorded.
- A viewer with `incognito_visits = true` is not recorded.
- If the viewer's incognito setting cannot be read, tracking fails closed and no visit is written.
- Visitor history is private. `GET /users/:id/visitors` only succeeds when the authenticated requester owns `:id`.
- The existing `GET /users/me/visitors` endpoint remains available for backward compatibility.
- Logs for visit-recording failures do not contain user IDs, profile IDs, tokens, or profile content.

## Query contract

`GET /users/:id/visitors` accepts `limit` and `offset` query parameters. `limit` defaults to 50 and is capped at 100; `offset` defaults to 0. Results are ordered newest first and include the visitor summary already used by the existing visitor history surface.

The query uses the existing `profile_visits_viewed_id_idx` index defined by `supabase/migrations/002_trust_and_safety.sql`. No schema migration is required for this change. Rows retain the existing `ON DELETE CASCADE` relationship to both users, so account deletion removes associated visit history.

## Failure behaviour

- Invalid pagination returns a validation error.
- Cross-user visitor-history reads return a forbidden response.
- Database failures while reading visitor history return an unavailable server error rather than an empty fabricated history.
- Visit writes are best effort after a successful profile read. Privacy lookup and insert failures are recorded only as sanitised server warnings.

## Verification

Focused tests cover normal recording, self views, incognito privacy, privacy lookup failure, persistence failure, owner-only history access, bounded pagination, response normalisation, successful-profile interception, unrelated endpoints, and failed profile reads.

Repository CI remains authoritative for backend lint, unit tests, build, E2E tests, database validation, and security/dependency checks.

## Rollback

Rollback is a normal code revert. There is no migration or data transform. Existing `profile_visits` rows and the backward-compatible `/users/me/visitors` endpoint are unaffected.
