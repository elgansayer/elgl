# Admin one-click moderation actions

Issue: #1818

## Product contract

The Admin Users screen exposes two direct moderation actions for each loaded user: **Warn** and **Ban**. Both actions use the existing authenticated admin API and are unavailable while the browser is offline. A repeated click cannot start a second mutation while the same action type is already pending.

`POST /admin/users/:id/warn` creates an authoritative open `admin_warning` report. `POST /admin/users/:id/ban` creates the existing admin-to-user block record used by the current moderation model. Both endpoints are protected by `SupabaseAuthGuard`, `AdminGuard`, and the `moderation.cases.manage` capability, use private no-store responses, and are throttled to five requests per minute.

This issue does not introduce a second moderation persistence model or client-side mock success path. The existing backend remains authoritative.

## Failure and retry behavior

The UI keeps the action pending until the request settles and releases the pending state in `finally`, so a failed request can be retried. Failures are sent through the existing crash-report/error-handler path rather than being represented as success. Offline actions remain disabled.

The backend records success/failure metrics. A successful warning invalidates user, report, and target login-history caches. A successful ban invalidates user, block, and target login-history caches. Cache invalidation failures are best-effort and do not roll back a moderation mutation that has already committed.

## Security and privacy

The browser never supplies an administrator identity. The authenticated request principal is passed to the service by the controller, while the target ID comes from the protected route. Both mutation endpoints require `moderation.cases.manage` in addition to the repository's normal admin guard.

No privileged mutation is available through an offline/mock fallback. Moderation responses are marked private/no-store and rate limited to reduce accidental or abusive repeated actions.

## Accessibility

Warn and Ban are native Spartan buttons with visible translated text. Their disabled state is represented with the native `disabled` attribute, so keyboard and assistive-technology users receive the same offline/pending protection as pointer users.

## Verification

`frontend/src/app/pages/admin/admin-moderation-actions.contract.spec.ts` locks the cross-layer contract: rendered controls, duplicate suppression, authenticated client calls, admin/capability guards, no-store/throttle policy, persistence targets, and cache invalidation.

The repository's normal frontend unit suite, backend unit/lint/build/E2E suite, and governance checks remain the merge gate.

## Rollback

This change adds regression coverage and documentation around the already-shipped moderation path; it does not change schema or API response shapes. Rollback is a normal revert of the contract/documentation commit. Do not replace the protected backend mutations with client-side mock moderation state.
