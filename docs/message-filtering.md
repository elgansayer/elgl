# First-contact message filters

Issue #772 lets a user restrict who may start a direct conversation with them by age, gender, and native language.

## Product contract

The Settings route owns four optional filters:

- minimum age, from 0 through 150;
- maximum age, from 0 through 150;
- one or more allowed native-language codes;
- one or more allowed genders: `male`, `female`, or `other`.

An empty filter category means no restriction for that category. If both age bounds are present, the minimum must not exceed the maximum.

The policy applies only to the first message in a one-to-one room. Once a direct conversation contains a message, the thread is established and subsequent replies are not re-evaluated against first-contact filters. Group rooms are outside this policy.

## Enforcement layers

The Angular message-filter settings page reads and writes the authenticated user's policy through `GET /api/users/me/message-filters` and `PUT /api/users/me/message-filters`.

`ChatService` performs the normal application-level first-message check before persisting a chat message. The database additionally enforces the policy with `enforce_first_contact_message_filters` on `public.chat_messages`. The database trigger is the final boundary so service-role scripts, future endpoints, or other writers cannot bypass recipient filters merely by inserting a row directly.

The database constraint `users_message_filters_valid` also rejects new or updated policies with unknown keys, invalid age bounds, unsupported gender values, or unbounded language/gender lists. It is installed as `NOT VALID` so deployment does not fail because of historical rows, while all new and updated rows must satisfy it.

## Missing profile attributes

A user cannot satisfy an active filter by omitting the corresponding profile attribute. If a recipient restricts native language, age, or gender and the sender has not supplied that attribute, first-contact insertion fails closed.

This avoids turning profile incompleteness into a filter bypass. The UI should present the existing send failure rather than infer or fabricate demographic data.

## Privacy and error handling

The enforcement function does not return the recipient's configured age, language, or gender rules. A rejected first contact receives only the generic message `Initial message is not allowed by recipient message filters`.

The function is `SECURITY DEFINER` because enforcement must inspect both participants even when the caller cannot directly select private user columns. Its `search_path` is pinned to `public`, and execute permission is revoked from `PUBLIC`; it is invoked only by the table trigger.

No message text, credentials, or recipient filter values are logged by the trigger.

## Concurrency

Concurrent first-message attempts are independently checked before insertion. Both must satisfy the same recipient policy. The policy does not depend on an application cache and therefore remains effective for retries and alternate database writers.

## Verification

Relevant existing application regression coverage is in `backend/src/chat/chat.service.spec.ts`, including:

- native-language rejection;
- minimum-age rejection;
- maximum-age rejection;
- gender rejection;
- established-conversation bypass.

The Supabase clean-reset CI job is authoritative for migration syntax and replay. It must successfully apply `20260820210000_enforce_first_contact_message_filters.sql` on a clean database before merge.

For a manual smoke test on a non-production database:

1. Create two users and a direct `chat_rooms` row with both users in `chat_room_members`.
2. Set the recipient's `message_filters` to a rule the sender satisfies and insert the first `chat_messages` row; it must succeed.
3. Recreate an empty direct room, change the sender so an active filter is not satisfied, and insert the first message; PostgreSQL must reject it with SQLSTATE `42501`.
4. Insert a later message into an already established room; the first-contact trigger must allow it.
5. Verify a group room is unaffected.

## Rollout and rollback

Deploy the migration before relying on database-level enforcement. The migration is additive: it creates two functions, one constraint, and one trigger; it does not rewrite existing message or profile data.

If an emergency rollback is required, drop `enforce_first_contact_message_filters` from `public.chat_messages` first. The validation constraint may remain safely in place. Do not remove application-level enforcement while the trigger is disabled.
