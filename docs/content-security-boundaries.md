# Content security boundaries

## Decision

User and provider content is not one generic “string” security type.

The application distinguishes:

```text
plain text
multiline plain text
rich HTML v1
external URL
internal route
media asset reference
identifier
code/JSON/technical payload
credential/signature/token
```

Each type has its own validation, storage and rendering rules.

The backend no longer recursively mutates every incoming string through an HTML sanitiser before DTO validation. Rich HTML sanitisation is opt-in and versioned.

## Plain text

Messages, profile text, corrections, explanations, search text and most product content are plain text.

Plain text rules:

- preserve literal user text after domain validation;
- validate length and byte limits;
- define Unicode normalisation only where the domain requires it;
- reject prohibited control characters where appropriate;
- store as text, not generated HTML;
- return as JSON text;
- render in Angular through interpolation/property text sinks;
- never use `[innerHTML]` merely to preserve newlines or highlight text;
- encode separately for email, logs, CSV and other output contexts.

HTML sanitisation is not required when a string remains plain text and is rendered through a safe text sink. Destructively removing angle-bracket content from every input is not a substitute for correct rendering.

## Rich HTML v1

Rich HTML is permitted only for a feature whose contract explicitly names `rich-text-html-v1`.

Implementation:

```text
RichTextSanitiserService
SanitiseRichHtmlPipe
RICH_TEXT_POLICY_VERSION = rich-text-html-v1
```

Allowed elements:

```text
p
br
strong
em
ul
ol
li
blockquote
code
pre
a
```

Allowed attributes:

```text
href
title
```

Explicitly forbidden categories include scripts, styles, forms, interactive controls, frames, objects, embeds, SVG and MathML.

Links allow:

```text
http
https
mailto
internal absolute paths
same-document fragments
```

Unsafe or unknown protocols lose their `href`. All retained links receive:

```text
rel="noopener noreferrer nofollow"
```

This first policy intentionally excludes images, videos, inline styles, arbitrary classes and embedded widgets. Media is represented through the Cloudflare-native asset platform, not arbitrary rich HTML.

## Opt-in use

A controller or DTO field must document that it stores rich HTML before applying `SanitiseRichHtmlPipe`.

Example pattern:

```ts
@Post('article')
createArticle(
  @Body('body', SanitiseRichHtmlPipe) body: string,
): Promise<Article> {
  return this.service.create({
    body,
    bodyPolicyVersion: RICH_TEXT_POLICY_VERSION,
  });
}
```

The exact controller should use its feature DTO and authorization policy. The important rule is that the pipe is applied to the rich field, not to every property of an arbitrary object.

## Compatibility pipe

`SanitiseHtmlPipe` remains temporarily as a deprecated compatibility name. It:

- sanitises only a directly supplied string;
- does not recurse into arrays or objects;
- is not registered globally;
- must not be used for plain-text fields;
- should be replaced by `SanitiseRichHtmlPipe` as feature contracts are audited.

## URLs and routes

HTML sanitisation is not URL validation.

Every URL-like field must declare a purpose:

| Purpose | Required behaviour |
|---|---|
| Internal route | typed route identifier/parameters; no arbitrary scheme |
| External user link | parse with `URL`; allow documented protocols; safe outbound-link policy |
| Notification deep link | allowlisted internal routes; re-authorise destination after open |
| Media | asset ID and server-authorised delivery resolution |
| Provider callback | exact configured host/path/signature policy |
| Link preview | HTTP/HTTPS, SSRF protection, redirect revalidation and byte/time limits |

Reject executable and unknown schemes. Do not persist an expiring media URL as the asset identity.

## Provider and AI output

Translation, grammar, LLM and external provider output is untrusted.

- plain output remains plain text;
- rich output is accepted only when the feature explicitly supports and sanitises the policy version;
- provider HTML is not trusted because it came from a paid service;
- no output is passed through `bypassSecurityTrustHtml` in feature code;
- prompts, source text and output are excluded from logs/traces by default;
- generated corrections use typed text spans, not HTML strings.

## Email and notifications

Browser sanitisation does not secure other output contexts.

- email templates escape values for their HTML/text context;
- notification payloads contain bounded plain text and typed route data;
- push notification content follows preview privacy settings;
- logs and operator views encode stored values before rendering;
- CSV/spreadsheet exports handle formula injection separately.

## Uploaded content

Uploaded HTML is never executed by the product.

High-risk media rules:

- SVG is not inlined unless a separate sanitisation/isolation policy is approved;
- HTML is served only as a download with safe headers, if permitted at all;
- documents and archives use dedicated parser/scanner limits;
- image/audio/video bytes are verified independently from MIME and extension;
- object existence does not make an asset ready;
- private media uses authorised delivery.

See `docs/cloudflare-native-media.md` and #7468.

## Angular rendering

Default safe pattern:

```html
<p>{{ message.text }}</p>
```

Approved rich HTML must pass through one shared rendering component/directive that accepts only the documented sanitized representation. Feature-level `[innerHTML]` and `bypassSecurityTrust*` calls require a security-reviewed exception and migration owner.

The longer-term #7476 work introduces branded/generated content types and an unsafe-sink repository rule after the existing sink inventory is complete.

## Migration procedure

For each persisted/displayed field:

1. identify source and trust level;
2. classify plain text, rich HTML, URL or structured data;
3. define length, Unicode and validation rules;
4. identify every rendering/export sink;
5. preserve plain text without destructive HTML mutation;
6. apply `SanitiseRichHtmlPipe` only to approved rich fields;
7. version rich policy in storage where re-sanitisation may be required;
8. migrate legacy stored HTML before trusted rendering;
9. add source-to-sink tests;
10. remove compatibility sanitisation only after every consumer is classified.

## Testing

Required regression cases include:

- literal `<`, `>`, quotes and code examples in plain text;
- multilingual and bidirectional text;
- script and event-handler payloads;
- dangerous and obfuscated URL schemes;
- malformed/nested markup;
- legacy stored values;
- provider-generated content;
- SSR and browser rendering parity;
- email/push/export contexts;
- rich link attributes and unsafe-link removal;
- no recursive mutation of DTO objects.

Current executable checks:

```bash
node scripts/verify-content-security-boundaries.mjs
cd backend
npx vitest run \
  src/common/content/rich-text-sanitiser.service.spec.ts \
  src/common/pipes/sanitise-rich-html.pipe.spec.ts
```

## Operations and dependency policy

- Keep DOMPurify only for approved rich HTML.
- Keep jsdom current while server-side DOMPurify requires it.
- Remove the overlapping `xss` package after source/runtime proof.
- Move `@types/jsdom` to development dependencies and align it with the runtime version.
- Monitor DOMPurify and jsdom security advisories.
- Do not replace them with regex or a hand-written HTML parser.
- CSP and Trusted Types are defence in depth, not replacements for typed sinks and sanitisation.

## Rollback

Migrate field by field.

A rollback may restore a field-specific sanitiser at its approved rich-text boundary. It must not restore:

- global recursive request-string mutation;
- unsafe trusted-HTML bypasses;
- arbitrary URL acceptance;
- rich HTML support for fields defined as plain text;
- the assumption that stored or provider content is already safe for every sink.
