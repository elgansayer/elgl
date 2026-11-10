# Weekly community leaderboard

The gamification habit loop exposes two weekly community rankings:

- **Top correctors**: users who corrected the most moments this week.
- **Study hours**: users with the most study time logged this week.

The board resets every Monday at 00:00 UTC. It is calculated from recent
activity rather than lifetime counters so the ranking stays achievable and
rewarding for returning learners.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/leaderboard/weekly?limit=20` | Returns both weekly rankings. `limit` is bounded to 1-100 and defaults to 20 per category. |
| GET | `/leaderboard/top-correctors?limit=20` | Legacy lifetime corrector ranking, retained for backward compatibility. |

Example response:

```json
{
  "correctors": [
    { "user_id": "uuid", "display_name": "Alice", "avatar_url": null, "score": 12 }
  ],
  "study_hours": [
    { "user_id": "uuid", "display_name": "Bob", "avatar_url": null, "score": 4.5 }
  ]
}
```

`score` is a correction count for `correctors` and rounded hours for
`study_hours`.

## Data sources

- `moment_comments` rows with a non-null `correction_payload` created during the
  current UTC week.
- `call_logs` duration for calls started during the current UTC week. Each call
  counts towards both participants, matching the existing `/stats/me` study-time
  definition. Durations are normalised to a maximum of 24 hours per call.

## Migration and security

`supabase/migrations/20261109090000_weekly_community_leaderboard.sql` adds a
partial index for weekly corrected comments and the
`get_weekly_leaderboard(p_limit)` SQL function.

The function is `SECURITY DEFINER` and executable only by `service_role`, so
browser roles cannot scan another user's correction history or call logs. It
returns aggregate scores and public profile fields only. Accounts with
`users.is_deleted = true` (GDPR deletion) are excluded from both rankings, so
erased users never appear on the public board. No new tables or
retention rules are required.

## Rollback

Revert the API and frontend to the legacy `/leaderboard/top-correctors` endpoint
and drop `get_weekly_leaderboard` plus
`moment_comments_correction_created_idx` in a new forward migration. The
legacy endpoint and its data are untouched by this change.

## Tests

- `backend/src/leaderboard/leaderboard.service.spec.ts`
- `backend/src/leaderboard/leaderboard.controller.spec.ts`
- `backend/src/database/weekly-leaderboard-migration.contract.spec.ts`
- `frontend/src/app/components/leaderboard/leaderboard.component.spec.ts`
