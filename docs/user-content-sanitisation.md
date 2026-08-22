# User content sanitisation and rendering

## Scope

This document records the production enforcement added for issue #1072. The original ticket asks for strict DOMPurify sanitisation on user-submitted text. The repository now uses a safer source-to-sink model: ordinary user text remains plain text and is rendered only through text sinks, while fields that explicitly support rich HTML pass through the shared DOMPurify rich-text policy.

Applying an HTML parser recursively to every request string is intentionally prohibited. That approach corrupts valid plain text such as code examples containing angle brackets, passwords, signatures, JSON and other technical payloads, while still failing to secure non-HTML output contexts such as CSV or logs.

The detailed field-classification policy remains in `docs/content-security-boundaries.md`.

## Runtime boundaries

### Plain text

Messages, profile text, corrections, search strings and similar fields are validated by their DTO/domain rules, stored as text and rendered by Angular interpolation or text/property bindings. The NestJS bootstrap must not register `SanitiseHtmlPipe` globally.

The deprecated `SanitiseHtmlPipe` remains only as a narrow compatibility boundary for a directly supplied string. It strips all markup with DOMPurify and returns non-string values untouched. It must never walk arrays or DTO objects.

### Rich HTML

Only a field whose contract explicitly permits `rich-text-html-v1` may use `SanitiseRichHtmlPipe` / `RichTextSanitiserService`. The shared DOMPurify policy allowlists a small formatting set, forbids active/embedded content, removes unsafe link targets and adds `rel="noopener noreferrer nofollow"` to retained links.

### Browser rendering

Production Angular source must not introduce raw HTML sinks such as `[innerHTML]`, `bypassSecurityTrustHtml`, direct `innerHTML` assignment, `insertAdjacentHTML`, or `document.write`. If a future feature genuinely requires rendered rich HTML, it needs a reviewed shared rendering primitive and an explicit update to the repository security contract rather than a local bypass.

The strict frontend `HtmlSanitisationService` continues to use DOMPurify for compatibility surfaces that deliberately convert markup to plain text and rejects executable `javascript:` and `data:` URLs.

## Automated enforcement

Run:

```bash
npm run check:content-security-boundaries
```

The check verifies that:

- the deprecated backend HTML pipe is not globally registered;
- the compatibility pipe cannot recursively mutate DTOs;
- the explicit rich-text pipe rejects non-string input;
- the rich DOMPurify policy retains its allow/forbid and safe-link markers;
- the frontend strict DOMPurify boundary retains its no-markup policy and dangerous-URL rejection;
- production frontend and admin-portal Angular sources do not contain unreviewed raw HTML sinks.

This check is part of the root `npm run verify` pipeline. Backend unit coverage also locks the legacy compatibility pipe to direct-string-only behaviour, including regression coverage for arrays and nested DTOs.

## Security and privacy

Sanitisation is not authorization, URL validation, upload validation or output encoding for every context. Authentication and authorization stay at their existing feature boundaries. User content, sanitised or otherwise, must not be copied into logs, traces or error messages unnecessarily.

Provider and AI output is treated with the same trust model as user content. Plain output remains text; provider-supplied HTML is not trusted merely because it originated from a paid service.

## Failure behaviour

Plain-text requests are no longer modified before validation. Invalid fields therefore fail through the normal DTO/domain validation path rather than being silently rewritten into another value.

For explicitly rich fields, invalid types fail closed before sanitisation. DOMPurify strips disallowed markup and unsafe link targets according to the versioned policy. A caller must never fall back to unsanitised HTML when sanitisation fails.

## Rollout

No database migration or persisted-data rewrite is required. Deploy the backend and verification changes normally. Existing stored plain text remains valid because request-time recursive sanitisation is removed rather than changing the schema.

Before deployment, run the repository verification suite and specifically exercise messages/profile fields containing literal angle brackets to confirm they round-trip as text. Exercise the rich-text sanitizer with script/event-handler/unsafe-link payloads and confirm only the allowlisted representation survives.

## Rollback

Revert the application commits if necessary. Do not restore the global recursive `SanitiseHtmlPipe`: doing so reintroduces destructive request mutation and can corrupt credentials or technical payloads. A rollback that needs HTML support must keep sanitisation at an explicit field-level rich-text boundary and must not add raw browser HTML sinks.
