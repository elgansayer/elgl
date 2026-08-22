# Word of the Day

Issue #1126 replaces the original hard-coded `Hola` placeholder with a deterministic, authenticated learning feature on the Home screen.

## Product contract

`GET /word-of-the-day` requires a valid Supabase session. The backend reads only the learner's language preferences, chooses the first target language (falling back to the first native language and then English), and returns one curated word for the current UTC calendar day. Locale variants such as `ja-JP` are normalised to their base ISO code. Unsupported catalogues deliberately fall back to English until a reviewed catalogue is added.

The response contains `word`, `translation`, `language`, `languageCode`, `example`, and the UTC `date`. Selection is deterministic for a language and date, so retries, multiple app instances, and edge-cache hits cannot produce competing daily words. The catalogue is code-owned rather than generated at request time, which avoids provider cost, prompt injection, and non-deterministic or unsafe learning content.

The Home card sends the current access token, renders loading and unavailable states without substituting fake learning content, and allows long translated text to wrap at narrow widths and high zoom. User-authored content is not involved in this feature.

## Security and privacy

The endpoint is protected by `SupabaseAuthGuard`; a missing authenticated user fails closed with `401`. The service does not accept a client-supplied user ID or language override, so one learner cannot request another learner's preferences. Profile lookup failures are logged only by provider error code or exception class; user IDs, JWTs, profile values, and provider messages are not logged.

Responses use the repository's authenticated edge-cache policy (`Vary: Authorization`). This prevents one learner's language-personalised response from being reused for another learner while still absorbing repeated reads.

## Failure handling

If the profile lookup is unavailable, the service returns the reviewed English catalogue rather than failing the Home page. If the API itself or authentication fails, the Angular card displays the shared translated error state and does not resurrect the former `Hola` mock. No database writes or background jobs are required.

## Adding languages

Add a reviewed entry to `CATALOG` in `backend/src/word-of-the-day/word-of-the-day.service.ts`. Each catalogue should contain multiple words with concise translations and natural example sentences. Keep the ISO base code aligned with profile `target_languages` values and add service coverage for aliases or unusual normalisation rules.

## Verification

Focused coverage lives in:

- `backend/src/word-of-the-day/word-of-the-day.service.spec.ts`
- `backend/src/word-of-the-day/word-of-the-day.controller.spec.ts`
- `frontend/src/app/components/word-of-the-day/word-of-the-day.component.spec.ts`

The tests cover target/native/fallback language selection, UTC determinism and rotation, locale normalisation, provider failure, authentication, bearer-token delivery, unavailable UI, and removal of mock fallback content.

## Rollout and rollback

No schema migration is required. Deploy backend and frontend together because the frontend now expects authentication and the expanded response shape. During mixed-version deployment, the expanded backend response is backward compatible with the previous card; the new frontend requires the authenticated endpoint behavior.

Rollback is application-only: revert this change and redeploy. There is no persisted Word-of-the-Day state to repair or migrate. If an individual catalogue entry is incorrect, correct that catalogue entry in a forward patch; daily selection remains deterministic for every other entry.
