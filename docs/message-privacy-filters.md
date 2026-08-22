# Message privacy filters

Message privacy filters control who may send a user the first message in a one-to-one chat. They are intended to reduce unsolicited messages without breaking established conversations or group chats.

## User controls

The **Settings → Message Filters** screen supports:

- Everyone / filtering disabled
- Explicit gender allow-list (men, women, or other profile values)
- Same native language
- Same target language
- Same gender
- Same age
- Minimum and maximum age range

Selecting any restriction leaves the Everyone mode automatically. Clearing every restriction restores Everyone.

## API

Authenticated clients read and update the settings through:

- `GET /chat/settings`
- `PUT /chat/settings`

The `messageFilters` object is stored in `users.message_filters`. Updates are merged with existing chat preferences so changing message privacy does not reset translation, read-receipt, or enter-to-send settings.

Example:

```json
{
  "messageFilters": {
    "enabled": true,
    "allowEveryone": false,
    "allowedGenders": ["female"],
    "sameNativeLanguage": true,
    "sameTargetLanguage": false,
    "sameGender": false,
    "sameAge": false,
    "ageMin": 25,
    "ageMax": 40
  }
}
```

## Enforcement

The application performs normal chat safety checks, while the database migration installs `enforce_message_privacy_filters` as a `BEFORE INSERT` trigger on `chat_messages`. The trigger is deliberately the final privacy boundary so a stale or alternative client cannot bypass the recipient's settings.

The trigger only runs for rooms with exactly two members and only for the sender's first message in that room. Existing direct conversations and group chats continue to work normally. Missing profile data fails closed when an enabled rule needs that data.

Legacy snake-case settings (`age_min`, `age_max`, `allowed_genders`, and `allowed_native_languages`) remain supported by the database enforcement function so existing accounts are not silently made less private during rollout.

## Rollout and rollback

Apply the Supabase migration before deploying the UI/API changes. The migration is idempotent for the column and trigger replacement.

To disable the feature urgently without deleting stored preferences, drop the `enforce_message_privacy_filters` trigger. A later deployment can recreate it without losing user settings.
