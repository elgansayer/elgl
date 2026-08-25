# Correction quality voting

Issue #1670 adds community up/down quality ratings to correction comments on Moments.

## Product contract

- Only comments with a `correction_payload` can be rated.
- A signed-in user can mark another learner's correction as helpful or not helpful.
- Selecting the currently active rating toggles it off; selecting the opposite rating switches it.
- The API returns authoritative up/down totals and the current user's resulting vote after every mutation.
- Correction authors cannot rate their own corrections.
- Ratings are unavailable across an active block relationship.
- Ordinary comments never expose correction-rating controls.

The Moments UI renders the aggregate counts next to 44px minimum touch targets. `aria-pressed` exposes the current selection without relying on colour, and the actions remain standard keyboard-operable Spartan buttons.

## Security and privacy

`POST /moments/:id/comments/:commentId/vote` is protected by the existing Supabase authentication guard and accepts only the validated `up` or `down` DTO values. The route binds both the Moment and comment IDs before a mutation is attempted.

The additive `20260825080500_harden_moment_correction_votes.sql` migration moves toggling and aggregate counting into `rate_moment_correction`, a `SECURITY DEFINER` function that is executable only by `service_role`. It locks the correction row while changing the vote, so concurrent application replicas cannot create inconsistent totals. Browser roles lose direct table read/write grants; RLS remains correction-only and owner-scoped as defence in depth if direct grants are restored later.

The API exposes aggregate totals plus only the requesting user's own current vote. It does not expose the identities of other voters. Backend failure logging uses a fixed diagnostic message and does not include user IDs, Moment content, correction text, database errors, credentials, or tokens.

## Failure behaviour

The endpoint fails closed when the Moment/comment pair does not exist, the comment is not a correction, the user owns the correction, the correction author is blocked, the database mutation fails, or the returned aggregate is malformed. The UI keeps the previous server-confirmed state and shows the existing retryable vote-error toast when the request fails.

No vote is fabricated during provider or database degradation.

## Data lifecycle

Votes remain in `moment_comment_votes` and continue to cascade-delete with their correction comment or user. The unique `(comment_id, user_id)` constraint remains the storage invariant. This change adds no new user-content retention class and no unbounded query path; aggregate counts are scoped to one indexed comment.

## Verification

Relevant automated coverage includes:

- `backend/src/moments/correction-quality.service.spec.ts` for correction-only, self-vote, block, malformed-response and provider-failure behaviour;
- `backend/src/moments/moments.controller.spec.ts` for authenticated route binding;
- `backend/src/database/migrations/20260825080500_harden_moment_correction_votes.spec.ts` for atomicity and role/RLS boundaries;
- `frontend/src/app/components/moments-feed/moments-feed.correction-quality.spec.ts` for correction-only, accessible up/down controls and aggregate rendering;
- the standard clean Supabase migration replay, backend unit/build/lint, frontend unit/build/static-analysis, UI governance and E2E workflows.

## Rollout and rollback

Apply the additive migration before deploying the backend using `rate_moment_correction`, then deploy the frontend controls. Existing clients remain compatible because the HTTP route and response shape are unchanged.

Rollback application code first if necessary. The database function and stricter browser grants can remain safely deployed because existing supported clients use the NestJS endpoint. If direct browser access to `moment_comment_votes` must intentionally be restored, do so in a separate reviewed migration rather than editing historical migrations or weakening the server-owned transaction in place.
