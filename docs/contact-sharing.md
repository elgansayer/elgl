# Contact sharing

`POST /api/users/me/contact-sharing` lets an authenticated member share explicitly selected, verified contact fields with a specific person.

## Authorization

The service fetches the caller's own profile first and refuses when `privacy_hide_contact` is true. It then requires either:

- a mutual follow (`user_follows` in both directions), or
- a shared row in `chat_room_members` (an active chat room).

Everyone else receives `403`. Callers cannot nominate arbitrary profile columns, and the response only contains fields the caller asked for.

## Fields

- `share_email` returns `auth.users.email` only when `email_confirmed_at` is set.
- `share_phone` returns `auth.users.phone` only when `phone_confirmed_at` is set.
- `custom_social_handle` returns the validated handle the caller supplied (`@?[A-Za-z0-9_.-]{2,60}`).

If no requested field is verified the request is rejected with `400`; nothing is invented. Each successful exchange writes a sanitized structured log event (`contact_shared`) with actor, target, selected field names and outcome, but never the contact values themselves.

## Related columns

`supabase/migrations/20261114150000_add_contact_sharing_fields.sql` adds `users.contact_social_handle` and `users.privacy_hide_contact`.
