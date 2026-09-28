# Anki integration

ELGL can export the authenticated learner's flashcard library as an Anki-compatible UTF-8 TSV file.

## Export

`GET /api/flashcards/anki/export` requires the normal Supabase bearer token and is limited to five requests per minute. The response is an attachment named `elgl-anki-YYYY-MM-DD.tsv`, is marked `private, no-store`, and contains at most 5,000 cards per export.

The file uses Anki text-import headers supported by current Anki releases:

- tab-separated fields
- HTML enabled so source newlines can be represented safely as `<br>`
- deck preset to `ELGL Vocabulary`
- note type preset to `Basic`
- named columns: `Front`, `Back`, `Context`, `Pronunciation URL`, `ELGL ID`

The first field is the ELGL word/token so normal Anki duplicate matching can be used. The ELGL UUID is retained in a separate field for traceability but is deliberately not exported as an Anki GUID, because Anki recommends leaving GUID generation to Anki for externally-created notes.

## Audio

Existing `pronunciation_url` values are preserved in the `Pronunciation URL` field when they are absolute credential-free HTTP(S) URLs. Unsafe URL schemes, embedded credentials, data URLs and malformed URLs are omitted.

Text imports cannot bundle remote audio into Anki's `collection.media` directory. Anki's documented offline-media format is `[sound:filename.mp3]` after the media file has been copied into Anki's media collection. A future `.apkg`/media-bundle exporter can build on this endpoint without changing the existing TSV contract. Until then, the exported URL preserves the source needed for an online pronunciation field or a user-managed bulk-media workflow.

## Safety and privacy

- Exports are always scoped to the authenticated user server-side.
- Export responses are never shared-cacheable.
- User-authored text is HTML escaped before HTML-mode import, and tabs/newlines are normalized so one card cannot inject extra TSV rows or columns.
- Only HTTP(S) pronunciation URLs without credentials are exported.
- Provider/database errors fail closed with `503`; the service does not return a partial export as if it were complete.
- Logs contain only aggregate card counts, truncation state and sanitized provider error codes, not card text or pronunciation URLs.
- The hard 5,000-card cap plus 200-row pagination prevents unbounded scans and response growth. `X-Anki-Export-Truncated: true` tells clients when the cap was reached.

## Importing into Anki

1. Download the TSV from the authenticated export endpoint.
2. In Anki choose **File -> Import** and select the TSV file.
3. Verify that separator is Tab and HTML is enabled; modern Anki versions read these from the file headers.
4. Map Front/Back to the desired note fields. Context, Pronunciation URL and ELGL ID can be mapped to extra fields in a custom note type or ignored.
5. Review the preview before importing.

Importing an arbitrary Anki deck into ELGL is intentionally not part of this first production boundary. ELGL's SRS state, ownership rules and pronunciation URLs require validation before persistence, so a future importer should use an explicit preview/confirm flow rather than treating `.apkg` or TSV data as trusted flashcards.

## Verification

Focused tests cover Anki headers and field ordering, TSV/newline normalization, HTML escaping, unsafe pronunciation URLs, authentication failure, user scoping and private/no-store response headers.

## Rollout and rollback

This is an additive authenticated endpoint with no schema migration. Rollout requires only the normal backend deployment. Rollback is a code revert; existing flashcards and SRS state are unchanged. Mixed frontend/backend versions remain compatible because no existing endpoint or data model changes.
