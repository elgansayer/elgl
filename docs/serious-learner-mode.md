# Serious Learner mode

Issue: #838

## Product contract

Serious Learner mode is a persisted user preference stored as `users.serious_learner_mode`. It is separate from `users.is_serious_learner`, which describes whether a member currently qualifies as an active/high-intent learner. A user can therefore opt into the focused product mode without the application mutating their earned qualification.

When the mode is enabled:

- Moments is removed from mobile and desktop primary navigation.
- `MomentsStore.loadFeed()` returns without issuing a feed request, so a direct `/moments` visit cannot silently re-enable the social feed. Existing individual Moment URLs and content are not deleted.
- A visible app-shell indicator shows that the focused mode is active and provides a one-action way to disable it.
- Discovery requires the serious-learner cohort and, when the current profile has language goals, searches for the reciprocal primary pair: a partner whose native language is the learner's primary target language and whose target language is the learner's primary native language.
- Existing discovery safeguards remain in force, including authentication, blocked-user exclusion, privacy/search visibility, age/gender controls, and the existing degradation/caching path.

The existing `is_serious_learner` qualification remains based on study activity. It must never be used as the user's opt-in preference.

## State and persistence

`SeriousLearnerModeService` is the frontend source of truth. It reloads the preference when the authenticated account changes, resets to ordinary mode when no authenticated session exists, and ignores stale profile responses from a previous account.

A preference change is written to `PATCH /users/me` and then independently verified with `GET /users/me`. This second read is intentional: the legacy profile update path can degrade to mock profile data after a provider error, and the UI must not report a saved focused-mode preference unless the persisted value can be observed. Verification failure restores the prior local value.

The backend discovery controller independently reads the authenticated profile and forces `serious_learner_mode=true` plus `serious_learner_only=true` before the discovery query is built. This prevents a stale or modified client from turning off the high-intent cohort while the persisted mode is active and also makes spatial and non-spatial discovery paths behave consistently.

No database migration is introduced by this change because `serious_learner_mode` is already part of the existing users data contract and update DTO.

## Empty and degraded states

Strict reciprocal matching can legitimately return no candidates. The application does not silently substitute ordinary social/discovery content: the user remains in the focused mode and can explicitly disable it from the persistent app-shell indicator or Discovery toggle to broaden matching. Provider/search failures continue through the existing Discovery error/degradation UI rather than being interpreted as an empty successful result.

## Accessibility and responsive behaviour

The active-mode indicator uses semantic text rather than colour alone. Its disable control is a native button through the Spartan `hlmBtn` primitive and receives visible focus treatment. Removing Moments changes only the available navigation destinations; remaining links keep their native link semantics, labels, active-route state, and unread counters. The indicator truncates within the existing mobile top bar rather than forcing horizontal page overflow.

## Verification

Focused regression coverage includes:

- frontend preference bootstrap, account switching, persistence verification, and failure rollback;
- no Moments feed network request while focused mode is active;
- desktop Moments navigation suppression;
- app-shell dependency isolation;
- backend distinction between the persisted mode and earned serious-learner qualification;
- backend enforcement for both regular and audio-intro discovery paths.

Run the repository's normal frontend and backend Vitest suites plus lint/type-check/CI. In a staging session, verify the following manually:

1. Enable Serious Learner mode in Discovery and reload the application.
2. Confirm the mode indicator remains visible and Moments disappears from both responsive navigation variants.
3. Visit `/moments` directly and confirm no `/moments/feed` request is made.
4. Confirm Discovery requests include serious-learner filtering and a reciprocal primary language pair when both profile language lists are populated.
5. Disable the mode and confirm ordinary navigation and discovery return without an account reload.
6. Repeat with an API failure during preference save and confirm the previous mode remains active.

## Rollout and rollback

This is an application-only change over an existing persisted column, so deployment does not require a schema migration or data backfill. Roll out frontend and backend together so the app-level state and server-side discovery enforcement agree.

Rollback is code-only: revert this change. Existing `serious_learner_mode` values can remain in user rows because older code already tolerates the field. Do not rewrite or clear `is_serious_learner` during rollback because that field represents a separate earned qualification.
