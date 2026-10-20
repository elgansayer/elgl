# Learning goals profile field

Issue #1112 adds an optional free-text motivation field to a user's profile so language partners can understand what the learner wants to achieve.

## Product behaviour

The profile editor now exposes a **Learning goals** textarea alongside the existing bio and language settings. Existing text is loaded with the rest of the authenticated profile, and the profile save flow persists it through `PATCH /users/me` as `learning_goals`.

The field is optional and bounded to 1,000 characters in three places:

1. the Angular editor truncates input before it reaches profile state;
2. `UpdateProfileDto` rejects payloads longer than 1,000 characters or non-string values;
3. the database convergence migration adds a length check for new and updated rows.

When present, learning goals are rendered on the profile using Angular text interpolation rather than raw HTML. Newlines are preserved and long content wraps instead of forcing horizontal scrolling.

## Schema convergence

An older matchmaking migration introduced `users.learning_goals` as `TEXT[]`, while the current API, TypeScript profile contract, mock data, and matchmaking client use a single string. That mismatch could make otherwise valid profile updates fail on a clean/current database.

`20260822110000_learning_goals_free_text.sql` converges the deployed schema to `TEXT` without rewriting migration history:

- databases with no column receive a nullable `TEXT` column;
- legacy `TEXT[]` values are preserved as comma-separated text via `array_to_string`;
- unexpected non-text legacy types are converted with PostgreSQL text casting;
- a restart-safe, named 1,000-character check is added as `NOT VALID` so historical oversized content cannot block rollout while all new/updated values are still protected.

The latest active nearby-search RPC does not expose `learning_goals`, so this conversion does not alter its return signature.

## Privacy and security

Learning goals are profile content. They follow the same profile visibility, blocking, deletion, and authenticated update boundaries as the user's bio. The client does not execute the value as markup and no new logs or analytics include the field contents.

Users should not put secrets or sensitive account information in learning goals. The field is intended for language-learning motivations such as conversation confidence, exam preparation, travel, pronunciation, reading, or professional communication.

## Accessibility and responsive behaviour

The edit control has an explicit label tied to the native textarea, keeps a visible character count, and announces character-count changes through a polite live region. Read-only text is under a semantic section heading. Both editor and display use the existing responsive profile surface and wrap long text at narrow widths and high zoom.

## Failure handling

Profile loading and saving continue to use the existing profile error states. A failed profile save does not invent or replace learning-goals content. Client-side bounding prevents accidental oversized submissions, while the API and database independently reject invalid writes from stale or third-party clients.

## Verification

Focused frontend tests cover:

- rendering persisted learning goals;
- preloading the editor from the profile response;
- persistence through the existing profile update call;
- client-side 1,000-character bounding.

Backend tests cover DTO string/length validation and the migration contract for conversion, data preservation, bounded new writes, and restart safety. The repository's clean Supabase reset remains the integration check for the migration itself.

## Rollout and rollback

Deploy the database migration before or with the frontend. The migration is forward-compatible with existing clients because the API already models `learning_goals` as an optional string.

To roll back the UI, revert the frontend commit; keeping the database column as `TEXT` is safe for older application code that already sends strings. Do not automatically convert the column back to `TEXT[]`, because doing so would recreate the API/schema mismatch and require an explicit delimiter-to-array data policy.
