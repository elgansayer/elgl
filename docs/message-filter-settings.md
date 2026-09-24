# Message filter settings

Issue: #1100

## Purpose

Message filter settings let an authenticated user restrict who may send the first message in a direct chat. The current product supports:

- minimum age;
- maximum age;
- allowed native languages;
- allowed genders;
- matching the recipient's native language, target language, gender, or age.

The settings page is available through the existing settings route and persists through the authenticated `/users/me/message-filters` API.

## Ownership and data flow

`MessageFilterSettingsComponent` owns only presentation and editing state. `MessageFilterService` owns the authenticated HTTP boundary:

```text
GET /users/me/message-filters
PUT /users/me/message-filters
```

The service requires an existing access token and deliberately propagates HTTP failures. It must not replace unavailable server state with `{}` or convert a failed update into a successful no-op.

The API uses the repository's canonical snake-case contract. A database trigger is the final enforcement boundary when a sender attempts the first message in a direct room. It serialises concurrent first-message admission and verifies sender membership. Existing conversations are not retroactively blocked by this preference.

## Failure behaviour

Loading is fail closed in the settings UI. If the current persisted filters cannot be loaded:

1. the form is not rendered with synthetic defaults;
2. an accessible generic error is shown;
3. the user can retry the read;
4. save requests are suppressed until the authoritative state has loaded successfully.

This avoids a failed read being mistaken for "no filters" and then accidentally overwriting the user's existing restrictions.

Saving is also fail closed. A failed `PUT` leaves the current editor state in place, reports the existing translated save-error state, and does not display the saved confirmation. Concurrent duplicate saves are suppressed while the first request is pending.

## Security and privacy

- Both API calls use the current authenticated Bearer token.
- No message-filter values, access tokens, or backend error bodies are logged by the page or its API service.
- The browser does not persist a second copy of these settings in local or session storage.
- Server-side enforcement remains authoritative; hiding or disabling a browser control is never an authorization boundary.
- The client does not fabricate successful reads or writes during network/provider failure.

## Accessibility and responsive behaviour

The existing settings surface retains its translated labels and logical padding. Loading is exposed through a polite status region. An unavailable state uses an alert plus a native Spartan retry button, and saving exposes native disabled state plus `aria-busy` on the Spartan save action.

No new hard-coded product colours, physical-direction utilities, or custom keyboard handlers are introduced by the resilience change.

## Verification

The focused regression suites cover:

```bash
cd frontend
npm test -- --run src/app/services/message-filter.service.spec.ts
npm test -- --run src/app/pages/settings/message-filter-settings/message-filter-settings.component.spec.ts
```

The normal frontend verification and repository CI remain authoritative for compilation, static analysis, Spartan/design governance, and wider regressions.

## Rollout and rollback

Deploy the append-only Supabase migration before the API and UI. It upgrades the existing nullable column in place, preserves legacy values, and recognises both the canonical snake-case keys and older camel-case values during rollout.

Rollback is a normal code revert. Do not restore the previous `catchError(() => of({}))` / `catchError(() => of(undefined))` semantics for this settings workflow, because they make server outages indistinguishable from successful empty reads and successful writes.
