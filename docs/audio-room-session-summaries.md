# Audio room session summaries

Issue #680 adds participant-scoped, AI-generated learning summaries to archived audio rooms. The implementation is deliberately asynchronous: ending a room persists the archive and queues summary work instead of making the host wait for speech-to-text and LLM calls.

## User flow

1. An authenticated user joins an audio room. The backend records participation in `audio_room_participants` after the normal room access checks have passed.
2. The host chooses **End and archive**. `POST /audio-room-archives/:id/finalize` marks the room inactive, finalises the LiveKit/Cloudflare recording when available, and creates a durable `audio_room_transcripts` summary job.
3. The request returns with `summary_status=pending`. Transcription and summarisation happen outside the archive request.
4. The scheduled worker advances the job through `pending -> processing -> ready` or `failed`.
5. Participants can open `/audio-rooms/archive` to view recording playback, the stored transcript, concise topic bullets, and a bounded vocabulary list. Viewing an archive never regenerates its summary.
6. A failed job is retried automatically with exponential backoff. The room host can also reset a failed job through `POST /audio-room-archives/:id/retry`.

## Durable job states

`audio_room_transcripts` now stores:

- `summary_status`: `pending`, `processing`, `ready`, or `failed`
- `summary_attempts`
- `summary_last_attempt_at`
- `summary_next_retry_at`
- `summary_ready_at`
- `summary_error_code`
- `updated_at`

The worker checks the queue every 30 seconds, processes a bounded batch, and recovers `processing` jobs that have been abandoned for more than ten minutes. The application also guards duplicate work inside each process. A unique index on `room_id` makes duplicate archive callbacks idempotent at the database layer.

The migration de-duplicates historical rows before creating the unique index, so it remains safe on installations that previously accepted more than one transcript row for a room.

## Transcription and summarisation

The worker prefers an existing transcript, then attempts transcription from the archived recording, then falls back to stored live captions. If no speech is available, the job becomes `ready` with an unavailable/empty summary instead of remaining stuck forever.

Long transcripts are bounded before LLM processing and split into chunks. Each chunk is treated as untrusted data inside a prompt-delimited transcript section. Partial chunk failures are tolerated, successful chunk results are de-duplicated, and final output is limited to a small number of topics and vocabulary entries. If every LLM chunk fails, the existing local NLP session-summary implementation is used as a fallback.

Configuration knobs:

| Variable | Default | Bound |
| --- | ---: | ---: |
| `AUDIO_ROOM_SUMMARY_MAX_ATTEMPTS` | 4 | 1-10 |
| `AUDIO_ROOM_SUMMARY_MAX_TRANSCRIPT_CHARS` | 24000 | 4000-80000 |
| `AUDIO_ROOM_SUMMARY_CHUNK_CHARS` | 4000 | 1000-8000 |

Stored transcript text is additionally capped at 100,000 characters.

## Privacy and access control

Archived recordings, transcripts, and summaries are not public assets in the product API. Access is granted only to:

- the host
- the co-host
- approved speakers or explicitly invited users
- authenticated users whose successful room participation was recorded

The new archive API performs this check in the NestJS service. RLS on `audio_room_transcripts` mirrors the same participant rule. The legacy `GET /audio-rooms/:id/transcript` route is covered by a compatibility interceptor because the existing audio-room service uses the service-role Supabase client and therefore bypasses RLS.

Private-room participation can only be recorded for the host, co-host, approved speakers, or invited users. Direct client inserts into `audio_room_participants` are not permitted by RLS.

Summary error storage is intentionally non-sensitive. `summary_error_code` contains only machine-readable categories such as `transcription_failed` or `summary_generation_failed`. Provider payloads and transcript content are never written to error fields or warning logs.

## Retention and deletion

Existing data-retention processing removes audio-room transcript rows after the configured archive retention period. Room deletion cascades to transcript and participation rows through foreign keys.

Account deletion is implemented as a soft-delete in this application. The migration therefore adds a database trigger for the `users.is_deleted` transition. It removes transcript/summary data for rooms hosted by that user and removes the deleted user's participation rows immediately. Participant deletion does not erase a host's room transcript for other legitimate participants.

Cloudflare recording-object lifecycle remains governed by the existing media retention/deletion pipeline. The archive summary feature stores only the recording URL and derived learning data.

## API

- `GET /audio-room-archives`: archived rooms visible to the authenticated participant
- `GET /audio-room-archives/:id`: recording/transcript/summary state for one authorised archive
- `POST /audio-room-archives/:id/participation`: record a successful authenticated room visit
- `POST /audio-room-archives/:id/finalize`: host-only archive and enqueue operation
- `POST /audio-room-archives/:id/retry`: host-only reset of a failed summary job

All archive responses are sent with `Cache-Control: no-store` through the existing cache-control interceptor.

## Verification

Relevant automated coverage includes:

- participant-only and private-room access checks
- long-transcript chunking and output de-duplication
- local NLP fallback when all LLM chunks fail
- retry state reset and re-queue behaviour
- archive UI ready/processing/failed states
- recording, summary, vocabulary, and transcript rendering

Before rollout, run the repository lint, backend tests, frontend tests, and migration replay checks. Validate one public and one private room against a staging Supabase project, including a simulated LLM outage followed by retry.

## Rollout and rollback

Deploy the database migration before the application release so the worker can write durable status columns and participation rows. Then deploy the NestJS backend and Angular frontend together.

For rollback, stop application instances containing the summary worker first. Revert the frontend/backend application release while leaving the additive status columns and participation table in place. They are backward-compatible with the previous code and retain privacy protections. Do not restore the old broad `Authenticated users can view transcripts` RLS policy. A later controlled migration can remove unused additive columns only after all older application versions have been retired.
