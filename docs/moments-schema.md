# Moments schema contract

Issues #981, #1345 and #1827 concern `supabase/migrations/005_moments.sql`. The migration already exists on `main`. It creates `public.moments`, `public.moment_comments` and `public.moment_likes`, together with the `user_follows`, `moment_comment_votes` and `moment_question_answers` tables that the same feature needs.

Migration history is append-only. `scripts/check-migration-delta.mjs` rejects modified, renamed and deleted migrations, so `005_moments.sql` must not be edited. Every schema change belongs in a new forward migration. This document describes the fully migrated state and is protected by `backend/src/database/moments-migration.contract.spec.ts`.

## Baseline data model

Application code must use the column names below. Earlier drafts of `SPEC.md` described `author_id`, `content_text` and `detected_language`; those columns do not exist. Moments and comments are owned through `user_id`, the text column is `text_content`, and the language column is `target_language`.

Several services were written against the earlier drafts and queried the retired names. PostgREST answers such a query with `42703` (unknown column), while the existing unit-test doubles accepted any column. Issue #1827 moved the GDPR archive, legacy data export, account deletion, user statistics, profile statistics, moderation and the older feed service onto the real columns. `backend/src/database/moments-migration.contract.spec.ts` now parses every `.from('<moments table>')` chain in `backend/src` and fails when any production query names a column that the migrated schema does not have.

Raw SQL is checked as well, because a trigger or function body is not a `.from()` chain and plpgsql resolves column names only when the function runs. `backend/src/leaderboard/update-correction-ratio.sql` is a draft trigger that no migration installs, and it named `author_id` on both `moments` and `moment_comments`. Applied as written it would have been accepted and then failed every comment insert. It now uses `user_id` and carries a header saying that it must be installed through a forward migration. Installing it is a separate product decision, because `users.correction_ratio` is a candidate filter and ranking signal in partner discovery (`DiscoveryService`).

### `public.moments`

One row per post. Regular Moments, question posts, language questions and 24 hour stories share the table; `post_type` and `is_ephemeral` tell them apart.

| Column | Type and default | Notes |
| --- | --- | --- |
| `id` | `UUID` primary key, `uuid_generate_v4()` | |
| `user_id` | `UUID NOT NULL`, references `public.users(id)` `ON DELETE CASCADE` | Author. |
| `text_content` | `TEXT`, nullable | The API accepts up to 5,000 characters. |
| `media_urls` | `TEXT[]`, default `'{}'` | Cloudflare R2 URLs. The API accepts up to 9. |
| `media_type` | `VARCHAR(50)`, default `'none'` | The API writes `none`, `images`, `audio` or `video`. Not enforced by a database check. |
| `target_language` | `VARCHAR(50) NOT NULL`, default `'en'` | Language community that the Classmates feed matches on. Writers must omit the key rather than send `null` to get the default. |
| `voice_note_url` | `TEXT`, nullable | Cloudflare R2 URL of a voice note. |
| `post_type` | `VARCHAR(50)`, default `'moment'` | The API writes `moment`, `question` or `language_question`. |
| `question_text` | `TEXT`, nullable | Prompt for question posts. |
| `question_options` | `TEXT[]`, default `'{}'` | Answer choices. Language questions accept 2 to 4. |
| `correct_answer` | `VARCHAR(255)`, nullable | Expected answer of a language question. |
| `correct_answers_count` | `INTEGER NOT NULL`, default `0` | Derived from `moment_question_answers`. |
| `total_answers_count` | `INTEGER NOT NULL`, default `0` | Derived from `moment_question_answers`. |
| `is_pinned` | `BOOLEAN NOT NULL`, default `false` | Pinned posts sort first in the All and Classmates feeds. |
| `likes_count` | `INTEGER NOT NULL`, default `0` | Denormalised counter, see below. |
| `comments_count` | `INTEGER NOT NULL`, default `0` | Denormalised counter, see below. |
| `is_ephemeral` | `BOOLEAN NOT NULL`, default `false` | `true` for stories. |
| `expires_at` | `TIMESTAMPTZ`, nullable | Story expiry. `null` for permanent posts. |
| `created_at` | `TIMESTAMPTZ NOT NULL`, default `now()` | |

### `public.moment_comments`

| Column | Type and default | Notes |
| --- | --- | --- |
| `id` | `UUID` primary key, `uuid_generate_v4()` | |
| `moment_id` | `UUID NOT NULL`, references `public.moments(id)` `ON DELETE CASCADE` | |
| `user_id` | `UUID NOT NULL`, references `public.users(id)` `ON DELETE CASCADE` | Comment author. |
| `text_content` | `TEXT`, nullable | The API accepts up to 2,000 characters. |
| `correction_payload` | `JSONB`, nullable | `{ "original": "...", "corrected": "...", "explanation": "..." }`, where `explanation` is optional. A non-null payload marks a correction that other learners can rate. |
| `parent_comment_id` | `UUID`, nullable, references `public.moment_comments(id)` `ON DELETE CASCADE` | Set on a threaded reply. |
| `reply_to_user_id` | `UUID`, nullable, references `public.users(id)` `ON DELETE CASCADE` | The author being replied to. |
| `created_at` | `TIMESTAMPTZ NOT NULL`, default `now()` | |

`012_comment_replies.sql` re-declares `parent_comment_id`, `reply_to_user_id` and their index with `ADD COLUMN IF NOT EXISTS`. The definitions are identical to `005_moments.sql`, so replaying the chain, and databases created before the columns moved into `005_moments.sql`, converge on one shape.

### `public.moment_likes`

| Column | Type and default | Notes |
| --- | --- | --- |
| `id` | `UUID` primary key, `uuid_generate_v4()` | |
| `moment_id` | `UUID NOT NULL`, references `public.moments(id)` `ON DELETE CASCADE` | |
| `user_id` | `UUID NOT NULL`, references `public.users(id)` `ON DELETE CASCADE` | The viewer who liked the Moment. |
| `created_at` | `TIMESTAMPTZ NOT NULL`, default `now()` | |

The named constraint `unique_moment_like` on `(moment_id, user_id)` allows one like per user per Moment. It is the concurrency boundary: two simultaneous like requests cannot create two rows, whatever the application does.

### Companion tables created by the same migration

- `public.user_follows` has the composite primary key `(follower_id, following_id)`, both referencing `public.users(id)` with `ON DELETE CASCADE`. It drives the Following feed, story visibility and timeline fan-out.
- `public.moment_comment_votes` records up and down votes on corrections, unique per `(comment_id, user_id)`. `005_moments.sql` named the vote column `vote_type`; `20260817052000_converge_moment_comment_votes.sql` renames it to `vote`, and `20260825080500_harden_moment_correction_votes.sql` moves writes into the service-role-only `rate_moment_correction` function and revokes direct client DML.
- `public.moment_question_answers` records one answer per `(moment_id, user_id)` in `selected_answer` (`VARCHAR(255) NOT NULL`) with an `is_correct` flag. The unique constraint keeps the first answer, so a retried request recomputes identical aggregate counts.

### Denormalised counters

`likes_count` and `comments_count` are written by `MomentsService` after the child row changes. No trigger maintains them, and the update is a read followed by a write. Concurrent toggles can therefore leave a counter stale even though `unique_moment_like` prevents duplicate rows. Treat the counters as display values and the child tables as the source of truth. To repair one Moment from a privileged session:

```sql
UPDATE public.moments AS m
SET likes_count = (SELECT count(*) FROM public.moment_likes AS l WHERE l.moment_id = m.id),
    comments_count = (SELECT count(*) FROM public.moment_comments AS c WHERE c.moment_id = m.id)
WHERE m.id = '<moment id>';
```

## Query and index contract

Every query the API issues against these tables has a supporting index, except where noted.

| Query | Index | Migration |
| --- | --- | --- |
| Author timeline: `WHERE user_id = $1 ORDER BY created_at DESC` | `moments_user_created_idx` | `005_moments.sql` |
| Following feed fallback: `WHERE user_id IN (...) ORDER BY created_at DESC LIMIT 50` | `moments_user_created_idx` | `005_moments.sql` |
| All feed: `ORDER BY is_pinned DESC, created_at DESC LIMIT 50` | `moments_pinned_created_idx` | `20261102090000_moments_feed_indexes.sql` |
| Classmates feed: `WHERE target_language = $1 ORDER BY is_pinned DESC, created_at DESC LIMIT 50` | `moments_lang_pinned_created_idx` (`moments_lang_idx` remains for plain language lookups) | `20261102090000_moments_feed_indexes.sql` |
| For You candidates: `ORDER BY created_at DESC LIMIT 100` | `moments_created_at_idx` | `20260925090000_moments_for_you_indexes.sql` |
| Stories: `WHERE is_ephemeral AND expires_at > now() AND user_id IN (...)` | `moments_is_ephemeral_idx` | `005_moments.sql` |
| Media and question filters | `moments_media_type_idx`, `moments_post_type_idx` | `005_moments.sql` |
| Comment thread: `WHERE moment_id = $1 ORDER BY created_at ASC` | `moment_comments_idx` | `005_moments.sql` |
| Replies to a comment: `WHERE parent_comment_id = $1` | `moment_comments_parent_idx` | `005_moments.sql`, `012_comment_replies.sql` |
| Did the viewer like these Moments: `WHERE user_id = $1 AND moment_id IN (...)` | `unique_moment_like` (its index) and `moment_likes_moment_user_idx` | `005_moments.sql` |
| Who liked a Moment: `WHERE moment_id = $1 ORDER BY created_at DESC, user_id ASC OFFSET $2 LIMIT $3` | `unique_moment_like` (its index) and `moment_likes_moment_user_idx` serve the filter; the sort covers the likes of that one Moment only (see below) | `005_moments.sql` |
| Viewer engagement history: `WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100` | `moment_likes_user_created_idx` | `20260925090000_moments_for_you_indexes.sql` |
| Fan-out followers: `WHERE following_id = $1 AND follower_id > $2 ORDER BY follower_id LIMIT $3` | `user_follows_following_idx` | `20261102090000_moments_feed_indexes.sql` |
| Followed authors: `WHERE follower_id = $1` | `user_follows_follower_idx` and the primary key | `005_moments.sql` |
| Correction votes by comment | `moment_comment_votes_comment_idx` | `005_moments.sql` |
| Answers by Moment and by user | `moment_question_answers_moment_idx`, `moment_question_answers_user_idx` | `005_moments.sql` |
| Archive, export and statistics for one user: `WHERE user_id = $1 ORDER BY created_at DESC` (archive pages of 500) | `moments_user_created_idx`, `moment_comments_user_created_idx`, `moment_likes_user_created_idx` | `005_moments.sql`, `20261102090000_moments_feed_indexes.sql`, `20260925090000_moments_for_you_indexes.sql` |
| Erase one user's correction votes: `DELETE ... WHERE user_id = $1`, and the cascade from `public.users` | `moment_comment_votes_user_idx` | `20261102090000_moments_feed_indexes.sql` |
| Erase comments addressed to a deleted user: `DELETE ... WHERE reply_to_user_id = $1` | partial `moment_comments_reply_to_user_idx` | `20261102090000_moments_feed_indexes.sql` |
| Erase one user's follow edges: `WHERE follower_id = $1` and `WHERE following_id = $1` | the primary key and `user_follows_following_idx` | `005_moments.sql`, `20261102090000_moments_feed_indexes.sql` |

`moment_likes_moment_user_idx` duplicates the index that backs `unique_moment_like`, and `user_follows_follower_idx` duplicates the primary-key prefix. They stay because migration history is append-only; a future cleanup migration may drop them once mixed-version traffic has ended.

The likes listing returns at most 50 rows per request, but Postgres sorts every like of the requested Moment before it applies `OFFSET` and `LIMIT`, because no index leads with `(moment_id, created_at DESC, user_id)`. The cost is bounded by the like count of one Moment, which is small today. If a single Moment can collect tens of thousands of likes, add `CREATE INDEX ... ON public.moment_likes (moment_id, created_at DESC, user_id)` in a forward migration; it is not added now because `moment_likes` is a write-heavy table that already maintains four indexes (the primary key, the `unique_moment_like` index and two secondary indexes, one of which duplicates the unique index).

`moment_comments_reply_to_user_idx` is partial because null means the comment is not addressed to a specific user. It supports both the foreign-key cascade and the anonymising deletion fallback without indexing unrelated top-level comments.

`moments.text_content` has no trigram index because no API path searches Moment text. When a search endpoint is added, ship `CREATE INDEX ... USING GIN (text_content gin_trgm_ops)` in the same change; `pg_trgm` is enabled by `001_initial_schema.sql`.

### Bounds

Collection reads are bounded where the API exposes them:

- The All, Classmates, Following fallback, questions and stories reads return at most 50 rows. For You builds a bounded candidate pool described in [Moments For You ranking](./moments_for_you_ranking.md).
- `GET /api/moments/:id/likes` accepts `limit` from 1 to 50 and `offset` up to 10,000, ordered by `created_at DESC, user_id ASC` for stable pages.
- `GET /api/moments/:id/comments` returns the whole thread in one indexed query plus two batched hydration queries (profiles and votes), so there is no per-comment round trip. The thread itself is not paginated; bounding it needs an API pagination contract and is outside this schema change.
- Feed hydration batches author profiles and the viewer's likes with `IN (...)` lookups over at most the page of Moments, so the feed has no N+1 pattern.

## Authorisation and privacy

The Angular client never queries Supabase. Every read and write goes through the NestJS API (`SupabaseAuthGuard`), which uses the service-role key and applies the product rules: block lists (`SafetyService.getBlockedAndBlockerIds`), the story expiry filter, status visibility, targeted-language visibility and the correction-only vote rules.

`009_row_level_security.sql` adds defence in depth for direct database roles:

- `moments`: authenticated users may select every row and may insert, update and delete only rows where `auth.uid() = user_id`.
- `moment_likes` and `moment_comments`: authenticated users may select every row and may insert and delete only their own rows. There is no `UPDATE` policy, so direct clients cannot edit a like or a comment.
- No policy grants the `anon` role access to any of the three tables.

The `SELECT` policies are intentionally broad because the database cannot see block lists or story expiry. They are not an application-level visibility rule, and no client may rely on them for one. A direct-client read path would need new policies in a forward migration first.

Moment text, comments, correction payloads, voice notes and media URLs are user content. They must not appear in routine logs, metrics labels or trace attributes; log operation names, error classes and request correlation identifiers instead.

The right of access covers all three tables. `PrivacyService` adds `moments`, `moment_comments` and `moment_likes` to the GDPR archive, each read by `user_id` in pages of 500 and capped at 50,000 rows. An unreadable dataset fails the whole archive request (`gdpr_archive_dataset_failed dataset=<name>`) rather than producing an archive that looks complete. The legacy `GET /api/users/me/export` (`DataExportWorker`) returns the same three datasets and now throws, instead of returning `null`, when one of them cannot be read.

## Retention and deletion

Ownership uses `ON DELETE CASCADE` throughout:

- Deleting a user row removes their Moments, comments, likes, follows (in both directions), correction votes and question answers.
- Deleting a user row also removes comments addressed to them through `reply_to_user_id`.
- Deleting a Moment removes its likes, comments (and so their replies and votes) and question answers.
- Deleting a comment removes its replies and votes.

Two daily jobs act on accounts whose 30-day grace period has ended (see [GDPR personal data lifecycle](./gdpr-personal-data-lifecycle.md)), and only the first deletes the user row:

1. `AccountDeletionCron` (midnight) calls `UsersService.permanentDeleteAccount`. It deletes the user's Moments, comments, likes and follows explicitly, then deletes the `public.users` row, and the cascades above remove the rest.
2. `DataRetentionService.finaliseAccountDeletions` (04:00) handles accounts that are still pending, for example when the hard delete failed. It anonymises the user row instead of deleting it, so no cascade fires. `eraseMomentsData` therefore erases correction votes, question answers, likes, comments authored by or addressed to the user, Moments and follow edges explicitly, one statement at a time and children before parents, because deleting a Moment cascades into rows that other statements are also deleting and concurrent deletes can deadlock. Every statement is an idempotent delete. A failure aborts the finalisation, the account stays pending, and the next run retries.

Both jobs key every Moments table on `user_id`. Before #1827 they filtered `moments` and `moment_comments` on the nonexistent `author_id`. The hard-delete path was saved by the cascade; the anonymising path had nothing to catch it and also never touched likes, votes, answers or follows.

Erasing a user's likes and comments does not touch the denormalised counters on other people's Moments, so `likes_count` and `comments_count` stay one too high per erased row until the repair statement in [Denormalised counters](#denormalised-counters) is run for that Moment. Correction vote tallies are computed on read and need no repair.

Story expiry is enforced at read time with `is_ephemeral = true AND expires_at > now()`. This schema change does not add a purge job, so expired stories remain stored until their author or the Moment is deleted. A future purge must delete rows where `is_ephemeral AND expires_at <= now()` in bounded batches; `moments_is_ephemeral_idx` already covers that predicate.

Any change to these semantics (soft delete, legal hold, `SET NULL` instead of `CASCADE`) must ship as a new migration and update this document.

## Verification

- `backend/src/database/migrations/005_moments.spec.ts` locks the historical tables, constraints, indexes and RLS statements.
- `backend/src/database/moments-migration.contract.spec.ts` parses the migration and checks the full column inventory, cascade graph, duplicate guards, replay safety, RLS policy matrix, typed client rows, seed data conformance and the agreement between this document, `SPEC.md` and the SQL. Its production query suite reads every Moments query in `backend/src` and fails on a column the migrated schema lacks, scans the raw SQL under `backend/src` for retired names, and proves its own parser still sees the known call sites.
- `backend/src/database/migrations/20261102090000_moments_feed_indexes.spec.ts` and `20260925090000_moments_for_you_indexes.spec.ts` lock the additive index migrations and tie them to the queries they serve.
- `backend/src/moments/moments.service.spec.ts` covers the write paths against the migrated constraints: story creation without a language, and recording `selected_answer`.
- `backend/src/privacy/privacy.service.spec.ts`, `backend/src/users/data-export.worker.spec.ts`, `backend/src/users/users.service.spec.ts`, `backend/src/user-statistics/user-statistics.service.spec.ts` and `backend/src/moderation/moderation.service.spec.ts` assert the exact columns each service filters, selects and deletes on, because their Supabase test doubles cannot reject an unknown column.
- `backend/src/privacy/data-retention.service.spec.ts` covers the anonymising path: the eight erasure statements run in order and each filters on the real column, including `reply_to_user_id`; a failure at any step stops the sequence and leaves the account pending (no anonymisation, no later wipe), the next run repeats the whole sequence and finalises the account, and one account failing does not stop the others in the batch.

Repository CI also replays the whole migration chain on a clean Supabase database. For a deployment check, confirm that:

1. a second like by the same user on the same Moment is rejected with a unique violation (`23505`);
2. deleting a Moment removes its comments, replies, likes and answers;
3. an authenticated direct client cannot insert a Moment, comment or like owned by another user;
4. `EXPLAIN` for the All feed query shows an index scan on `moments_pinned_created_idx` once the table is large enough for the planner to prefer it;
5. `POST /api/privacy/request-archive` for an account with Moments completes and the archive contains `moments`, `moment_comments` and `moment_likes`;
6. `GET /api/user-statistics/:userId` answers for an account with Moments instead of `404 Could not load moments`.

Database errors that indicate contract drift are `23502` (a `NOT NULL` column received `null`), `42703` (an unknown column) and `23503` (a missing parent row). Log them as sanitised error categories without row content, direct user identifiers or provider error text. The structured messages `gdpr_archive_dataset_failed dataset=<name>` and `gdpr_moments_erasure_failed step=<name>` follow that rule.

## Rollout and rollback

`005_moments.sql` is unchanged. The forward migration `20261102090000_moments_feed_indexes.sql` adds six indexes, each `CREATE INDEX IF NOT EXISTS`, so it is safe to retry and safe for mixed application versions. It takes a brief write lock on `moments`, `moment_comments`, `moment_comment_votes` and `user_follows` while each index builds, so apply it in a quiet period on large installations.

To roll back the indexes, run the `DROP INDEX IF EXISTS` statements recorded in the migration header. Dropping them only costs query performance; no data or application contract depends on them.

Never edit or delete `005_moments.sql` to roll back or to fix a problem. Do not drop `public.moments`, `public.moment_comments` or `public.moment_likes` in a populated environment: that destroys user content and the vote and answer history that references it. If a column needs to change, add a new forward migration and keep the old shape working until mixed-version traffic ends.

The application changes are code-only and roll back with a normal revert:

- story creation omits `target_language` when none is chosen, and language-question answers are recorded in `selected_answer`;
- the GDPR archive, legacy export, user statistics, profile statistics, account deletion and moderation query `user_id`, `text_content` and the real `user_follows` columns;
- the archive and legacy export gain a `moment_likes` dataset, an additive key that older readers ignore;
- `DataRetentionService` erases the Moments tables before anonymising an account.

Reverting restores the earlier failures (the archive request fails, statistics answer `404`), so prefer a forward fix. Local development data is created by `npm run seed` in `backend/`, which now writes the migrated column names and seeds a Moment with a correction, a threaded reply and likes.

### Content left by the anonymising path

Accounts that `DataRetentionService` anonymised before this change kept their Moments, comments and any likes, votes, answers and follows. The path only runs when the midnight hard delete did not remove the account, so the set may be empty. Check read-only first:

```sql
SELECT
  (SELECT count(*) FROM public.moments AS m JOIN public.users AS u ON u.id = m.user_id WHERE u.is_deleted) AS moments,
  (SELECT count(*) FROM public.moment_comments AS c JOIN public.users AS u ON u.id = c.user_id WHERE u.is_deleted) AS comments,
  (SELECT count(*) FROM public.moment_likes AS l JOIN public.users AS u ON u.id = l.user_id WHERE u.is_deleted) AS likes;
```

If rows remain, an operator can erase them in the same order the application uses. The statements are irreversible, so take a backup and review the counts first; this document deliberately does not ship them as an automatic migration.

```sql
BEGIN;
DELETE FROM public.moment_comment_votes AS v USING public.users AS u WHERE u.id = v.user_id AND u.is_deleted;
DELETE FROM public.moment_question_answers AS a USING public.users AS u WHERE u.id = a.user_id AND u.is_deleted;
DELETE FROM public.moment_likes AS l USING public.users AS u WHERE u.id = l.user_id AND u.is_deleted;
DELETE FROM public.moment_comments AS c USING public.users AS u WHERE u.id = c.user_id AND u.is_deleted;
DELETE FROM public.moments AS m USING public.users AS u WHERE u.id = m.user_id AND u.is_deleted;
DELETE FROM public.user_follows AS f USING public.users AS u WHERE u.is_deleted AND (u.id = f.follower_id OR u.id = f.following_id);
COMMIT;
```
