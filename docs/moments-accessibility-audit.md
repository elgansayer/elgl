# Moments accessibility audit

Status: production-readiness audit for issue #2046  
Audited surface: `frontend/src/app/components/moments-feed/moments-feed.component.html` and the shared primitives it composes  
Audit date: 2026-08-26

## Scope and assumptions

This audit covers the Moments feed, composer, per-Moment actions, comments, media, and the modal entry points rendered by `MomentsFeedComponent`. It does not redefine the internal accessibility contracts of `AppEmptyStateComponent`, `ScrollablePillsComponent`, `TokenisedTextComponent`, `TextToSpeechComponent`, `WordDefinitionModalComponent`, `CorrectionModalComponent`, `LikedByModalComponent`, or `LightboxComponent`; those shared components retain their own contracts and tests.

No API, schema, authorization, persistence, analytics, or moderation behavior is changed by this audit. Existing product behavior remains authoritative. The purpose of this issue is to make the current screen-reader/ARIA state explicit, identify production gaps, and add an executable guard so the audit cannot silently become stale.

## Current production strengths

- The page exposes one `main` landmark and one `h1` page heading.
- Profile, notifications, and compose entry points have translated accessible names.
- Feed media opens through native Spartan buttons. Lightbox image buttons use the translated `lightbox.imageAlt` contract and the nested image is decorative (`alt=""`) to avoid duplicate announcements.
- Like, comments, correction, quote, translation, pin/unpin, reply, and cancel-reply actions are native buttons using the repository-owned `hlmBtn` primitive rather than synthetic `role="button"` controls.
- There is no positive `tabindex` or feature-owned synthetic button keyboard emulation in the Moments template.
- Loading and empty feed states reuse the shared empty-state primitive rather than exposing unstructured placeholder content.
- User-authored Moment text is rendered as text through `TokenisedTextComponent`; correction output uses the shared Visual Diff surface rather than trusted HTML.

## Findings

The following findings are the current audit baseline. They are deliberately recorded by stable IDs and checked by `scripts/moments-accessibility-audit.test.mjs`. When a finding is fixed, remove it from this baseline and update the contract in the same change. New findings must not be silently added to the baseline.

| ID | Priority | Finding | User impact | Required remediation |
| --- | --- | --- | --- | --- |
| MOM-A11Y-001 | P1 | The media-removal icon uses the hard-coded English accessible name `Remove media`. | Screen-reader users whose app language is not English hear mixed-language UI. | Replace with a translated repository key and preserve an explicit accessible name. |
| MOM-A11Y-002 | P1 | The voice-record action uses the hard-coded English accessible name `Record voice`. | Same localisation failure as above on an important composer action. | Move the accessible name to the translation system and keep the control native/Spartan-owned. |
| MOM-A11Y-003 | P1 | Composer image-URL and comment inputs expose the generic hard-coded accessible name `text input`. | The field purpose is not identifiable from the accessibility tree; repeated generic controls are ambiguous. | Bind each input to its visible/translated purpose with a label, `aria-labelledby`, or a purpose-specific translated `aria-label`. |
| MOM-A11Y-004 | P1 | The likes-count button that opens the Liked By modal has no explicit accessible name beyond the numeric count. | A screen reader may announce only a number, with no indication that it opens the list of people who liked the Moment. | Add a translated contextual label that includes the count where useful. |
| MOM-A11Y-005 | P1 | Media removal is `h-5 w-5` and comment submit is `h-8 w-8`, both below the repository 44 CSS-pixel touch-target baseline. | Touch, switch, tremor, low-vision, and high-zoom users have unnecessarily small targets. | Use Spartan `icon-touch` / equivalent 44px hit areas without enlarging the visual glyph. |

### Additional follow-up observations

These are lower-priority implementation observations discovered during the audit. They are not part of the executable baseline because the correct remediation depends on shared-component/product decisions:

- The author-avatar profile link should receive a meaningful accessible name. The nested image currently has no explicit `alt`; a translated `Avatar of {{name}}` contract or link label would make the destination unambiguous.
- Composer/avatar and new-media preview images should explicitly choose decorative (`alt=""`) versus informative alternatives rather than relying on a browser fallback.
- The compose section is visually introduced by the compose action but has no explicit heading/region relationship. A translated heading or labelled region would improve landmark navigation if the composer remains a substantial inline surface.
- Audio controls use the browser-native accessible surface. Locale, high-zoom width, and keyboard behavior should continue to be checked in browser-level accessibility verification.
- Feed update/error behavior is owned primarily by `MomentsStore`; if an unavailable state is added or changed, it must be exposed as a meaningful status/alert rather than visually only.

## Screen-reader review

The accessibility tree should preserve the following hierarchy:

1. Page heading: Moments.
2. Primary application actions in the sticky header.
3. Filter controls through `ScrollablePillsComponent`.
4. Optional composer controls.
5. One main feed region containing semantic Moment articles.
6. Per-Moment author, language/time metadata, content/media, then actions.
7. Optional comments and reply composer.
8. Modal/dialog surfaces owned by their shared Spartan dialog components.

Important state must not be represented only by colour. Existing pinned state includes a text banner; like state includes both visual heart state and button semantics. Any future loading, failure, saving, or mutation-pending state must be announced through semantic status/busy/error behavior in addition to styling.

The feed must not expose private diagnostic/provider details through accessible labels, live regions, or error text. Accessible names may include already-visible profile display names or counts, but must not include email addresses, access tokens, internal IDs, raw database errors, provider payloads, or hidden moderation metadata.

## Keyboard and input-method review

Moments uses native links, inputs, textareas, audio controls, and Spartan/native buttons for the audited surface. That is the correct ownership boundary: browser/Spartan semantics should provide Enter/Space activation and deterministic focus behavior without feature-owned key emulation.

Required behavior:

- Tab order follows DOM/visual reading order and never uses positive `tabindex`.
- Icon-only actions keep visible `focus-visible` treatment through Spartan/Relay ownership.
- Enter in the comment field may submit only when that field's higher-level autocomplete/reply behavior does not consume the key.
- IME composition must not be treated as a submit keystroke. Any future key handler on text inputs must check the existing repository composition contract rather than adding raw `keydown.enter` behavior blindly.
- Dialogs/lightbox/correction surfaces retain focus trapping, Escape dismissal, initial focus, and focus restoration through the shared Spartan dialog implementation.

## Zoom and reflow review

At 200% and 400% zoom, Moments must reflow without two-dimensional page scrolling for ordinary prose/actions. Long translated labels and user-authored content must wrap instead of being clipped.

Current risks identified by this audit are the undersized media-removal and comment-submit targets. Remediation must enlarge hit areas while preserving responsive wrapping. Future changes should keep:

- action bars wrapping rather than overflowing;
- composer controls capable of stacking/wrapping at the 390px baseline;
- media galleries responsive and bounded;
- modal content internally scrollable when needed;
- no zoom-detection code or zoom-specific duplicated templates.

The repository's 200%/400% visual contracts remain the authoritative rendered verification layer.

## RTL and localisation review

The Moments layout already uses logical utilities such as `ms-*` and `end-*` in important composer/comment positions. New spacing and positioning must continue to use logical properties rather than `left`/`right` or `ml`/`mr`/`pl`/`pr` ownership.

ARIA names are user-visible strings and therefore part of localisation. MOM-A11Y-001 through MOM-A11Y-003 are production localisation gaps even though they are technically ARIA attributes. Remediation must use established translation keys/workflow rather than duplicating English strings in component code.

User-authored multilingual text should keep browser-native bidirectional behavior and shared `dir="auto"`/language ownership where the shared rendering component provides it. Do not infer a user's UI direction from the language of one Moment.

## Privacy and security review

Accessibility changes must not weaken existing authorization or content boundaries. In particular:

- Accessible labels for profile links may use the already-rendered display name but must not expose hidden profile fields.
- Liked-by labels may expose the already-visible aggregate count, not liker identities before the authenticated modal/API returns them.
- Image `alt` text must not be synthesized from private EXIF/file names or raw URLs.
- Provider/API/database failure details must not be copied into `aria-live` text.
- Correction/translation output remains plain/sanitized content; accessibility remediation must not introduce `innerHTML` or trusted-HTML bypasses.
- No new telemetry is required by this audit. If accessibility diagnostics are added later, they must contain stable event classes rather than user content or identifiers.

## Failure and partial-state review

This audit introduces no new network operation. Existing Moments APIs, persistence, retries, and authorization are unchanged.

For future remediation work:

- an accessibility enhancement must fail harmlessly if optional metadata such as an author display name is missing;
- labels should fall back to the existing translated member/unknown-user strings rather than exposing IDs;
- a failed media image must not remove the remaining usable action context;
- loading, empty, unavailable, and retry states must remain distinguishable to assistive technology;
- mutation failures must leave retryable controls and must not announce success before the authoritative API succeeds.

## Automated verification

Run from repository root:

```bash
node --test scripts/moments-accessibility-audit.test.mjs
```

The contract checks both positive invariants and the bounded known-debt baseline. Its purpose is to ensure that future Moments work either preserves the audited accessibility guarantees or explicitly updates this document when resolving a recorded finding. It is intentionally dependency-free so it can run before a frontend install and in merge-queue validation.

Normal repository CI remains authoritative for Angular unit tests, static analysis, production build, translation-safe APIs, RTL logical-property checks, touch-target checks, design governance, visual capture, and browser E2E coverage.

### Manual verification checklist for remediation PRs

- Keyboard-only: navigate header, filters, composer, each Moment action, comments, and dialogs.
- Screen reader: verify page heading/landmark order and contextual names for icon-only/repeated actions.
- 390px mobile and desktop: light and dark themes.
- Arabic/Hebrew UI: focus order and logical placement remain correct.
- 200% and 400% zoom: no clipped controls or horizontal page overflow.
- Reduced motion: interaction meaning remains available without decorative transitions.
- Missing author/media/error fixtures: labels remain useful and privacy-safe.

## Rollout and rollback

This audit and its verification gate are source/test/documentation-only. There is no database migration, API version, cache invalidation, persisted-state change, authentication change, or production data rollout.

Rollout is the normal adoption of the audit contract in pull-request validation. Follow-up remediation can ship incrementally; each fix should remove the corresponding `MOM-A11Y-*` baseline entry in the same PR after its own focused tests pass.

Rollback is a normal revert of the audit/contract commit. Reverting the audit does not alter user data or runtime behavior. Do not delete or suppress a genuine finding merely to make the guard pass; either remediate it or update the audit with a reviewed reason.
