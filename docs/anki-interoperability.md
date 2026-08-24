# Anki interoperability

Issue: #1609

## Scope

The first supported interoperability boundary is UTF-8 tab-separated text, which can be imported and exported by Anki Desktop without coupling the product to a local AnkiConnect process or to the binary `.apkg` container format.

Authenticated users can:

- download their current flashcard library from `GET /api/anki/export`;
- import up to 500 cards per request through `POST /api/anki/import`;
- round-trip the exported Front, Back, Context, and Definition columns;
- keep their existing SRS scheduling when an imported Front already exists.

The export is bounded to 1,000 cards per request. `X-Anki-Exported` reports the number of exported cards and `X-Anki-Truncated` reports whether the safety bound was reached.

## Import format

The importer accepts two to four tab-separated columns:

```text
Front<TAB>Back<TAB>Context<TAB>Definition
```

Context and Definition are optional. Blank lines, Anki metadata lines beginning with `#`, and an optional `Front<TAB>Back` header are ignored.

Validation follows the existing flashcard limits:

- Front: required, maximum 200 characters;
- Back: required, maximum 500 characters;
- Context: optional, maximum 1,000 characters;
- Definition: optional, maximum 1,000 characters.

Malformed or duplicate rows are skipped and returned with bounded line-number errors. The whole request is rejected when it contains more than 500 data rows. Storage failures return an unavailable response instead of reporting fictional imported cards.

## SRS and economy behaviour

Anki imports use a direct bounded upsert into the existing `flashcards` table. They deliberately do not call the normal create-card XP path, so bulk imports cannot be used to farm XP.

For an existing `(user_id, word_token)` record, the imported text fields are updated while SRS fields such as `srs_level`, `easiness_factor`, `repetitions`, `interval_days`, and `next_review_at` are left out of the upsert payload and remain owned by the current SRS engine. New rows receive the database defaults defined by the flashcard migration.

## Privacy and security

Both routes are protected by `SupabaseAuthGuard`. The user ID always comes from the authenticated Supabase session and is never accepted from the import payload.

The service does not log card text, translations, definitions, or import content. The import body is capped at 512,000 characters and 500 data rows, export work is bounded, and both routes are rate-limited.

The TSV export normalises tabs and line breaks inside fields so one flashcard cannot inject extra columns or records into the generated file.

## Why not `.apkg` or AnkiConnect

Binary `.apkg` generation adds a SQLite/archive/media compatibility surface that is unnecessary for basic interoperability. AnkiConnect also requires a user-operated desktop Anki instance and a local network bridge, which is not a reliable server-side product dependency.

Those formats can be added later behind the same service if there is a concrete product requirement. They should not replace the portable text contract.

## Verification

Relevant validation:

```bash
cd backend
npm test -- ankii-integration
npm run lint:check
npm run build
```

The service tests cover multilingual export, safe field normalisation, partial import failures, duplicate handling, the 500-card safety limit, and fail-closed storage behaviour. Controller tests cover authenticated user scoping for both import and export.

## Rollout and rollback

The feature is additive and requires no database migration. Rollout only requires deploying the backend containing the new `/api/anki` routes.

Rollback is a normal application revert. Existing flashcards remain ordinary SRS records and require no data rollback.