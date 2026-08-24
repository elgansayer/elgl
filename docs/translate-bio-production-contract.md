# Translate Bio production contract

Issue: #1680

## Scope

ELGL exposes a **Translate Bio** action on discovery profile cards and full user profile pages. The feature reuses the authenticated `POST /nlp/translate-bio` backend endpoint and the established NLP provider/rate-limit path. This document defines the client-visible production contract completed by #1680; it does not introduce a second translation API or persistence model.

## User flow

1. A profile with a non-blank bio shows a Translate Bio action.
2. The requested target language is the current UI language.
3. While the request is in flight, the action is disabled and reports a busy state.
4. On success, the translated text replaces the original bio in place and the action becomes **Show original**.
5. Selecting **Show original** restores the authoritative profile bio without another network request. The in-memory translation may be reused while the profile, source bio and UI language remain unchanged.
6. Changing profile, source bio or UI language invalidates the cached translation. Responses from an older request context are ignored.
7. Blank or whitespace-only bios do not expose a translation action and never trigger a translation request.

Translated bios are presentation-only. The source profile bio remains authoritative and no translated copy is written to the user profile or browser storage.

## Failure and degraded behavior

A failed, rejected or empty translation response leaves the original bio visible. The control becomes usable again and a polite, retryable error status is exposed to assistive technology. The UI does not substitute the source text while claiming that translation succeeded.

The backend endpoint remains authenticated, subject to the existing NLP request and quota limits, and uses private `no-store` cache headers. Provider/network failures remain owned by the NLP layer; the profile UI only renders a successful non-empty translation.

## Accessibility and international text

- Translate/Show original controls use the shared Spartan button primitive and retain normal keyboard activation and visible focus behavior.
- The action has at least a 44px logical-height touch target (`min-h-11`).
- Repeated discovery-card controls include the profile display name in their accessible label so screen-reader users can distinguish them.
- `aria-controls` associates the action with its bio region and `aria-pressed` communicates whether the translated view is active.
- Bio regions use `dir="auto"` so mixed RTL/LTR profile text follows its own content direction rather than the surrounding UI direction.
- Successful text replacement occurs in a polite live region and is marked atomic while the translated view is active.
- Translation failures use a polite status region and are associated with the action through `aria-describedby`.

## Privacy and security

Profile bio text is already visible to the authenticated viewer. Translation requests send the selected target profile identifier and target language to the ELGL backend; provider credentials are never exposed to the browser. The translated text is held only in component memory and is not persisted to `localStorage`, IndexedDB or the profile record by this feature.

No new schema, index, cookie, analytics event or long-lived cache is introduced. Existing backend authentication, NLP throttling and cache-control boundaries continue to apply.

## Verification

Regression coverage is maintained in:

- `frontend/src/app/components/profile-discovery-card/profile-discovery-card.component.spec.ts`
- `frontend/src/app/components/user-detail/user-detail.component.spec.ts`

The suites cover translation/show-original behavior, active-language targeting, stale response rejection, profile/language invalidation, retry behavior, busy state, blank-bio suppression, accessible control relationships, touch sizing and RTL-safe bio rendering.

Repository CI remains responsible for Angular compilation, formatting/linting, unit suites, translation-safe component APIs and UI-design governance.

## Rollout and rollback

This is a frontend contract hardening over the existing API and requires no migration or coordinated backend deployment. It is safe with older backend instances that already implement `/nlp/translate-bio`.

Rollback is a normal revert of the #1680 frontend/test/documentation commits. Reverting restores the previous presentation without deleting or migrating user data because this feature persists no translated bio state.
