# Devanagari and complex-script rendering verification

Issue: #5508 (`Spartan UI 0042`)

This verification contract makes the architecture in `docs/devanagari-complex-script-rendering.md` executable without adding a script-specific UI stack or changing any rendered product surface.

## What is protected

The standalone migration gate protects the smallest high-value invariants without depending on unrelated Angular test compilation:

- Hindi remains a first-class application language with `lang="hi"`, the native `हिन्दी` label, and horizontal LTR direction.
- document language and direction continue to derive from locale metadata rather than light/dark theme state.
- `Intl.Segmenter` round-trips representative Hindi, Bengali, Tamil, Thai, and Khmer content for both grapheme and word segmentation without rewriting source text.
- a Devanagari base character plus its dependent vowel sign is treated as one user-perceived grapheme rather than two visible characters.

The Angular regression spec additionally exercises the same Hindi document-language contract in explicit light and dark states as part of the normal frontend unit suite. The standalone gate exists so this migration contract remains independently runnable even when an unrelated frontend spec temporarily prevents Angular from compiling the full test graph.

The existing multilingual typography verifier remains responsible for structural migration rules including shared font ownership, prohibition of `font-display` on language-content surfaces, browser-native prose wrapping, and theme-neutral typography.

## Verification commands

Run the dedicated migration gate from the frontend workspace:

```bash
cd frontend
node scripts/check-multilingual-typography.mjs
node --test scripts/check-devanagari-rendering.test.mjs
```

Run the Angular light/dark regression once the normal frontend test graph compiles:

```bash
cd frontend
npm test -- --include='src/app/services/i18n.devanagari.spec.ts'
```

Before merge, run the normal frontend verification used by CI:

```bash
cd frontend
npm run lint:check
npm test
npm run build
```

GitHub Actions remains the authoritative clean-environment result. The dedicated `Devanagari and complex-script rendering` workflow runs the standalone structural and segmentation checks on pull requests and merge-queue heads that change this contract.

## Expected failure modes

The dedicated gate fails when any of these regressions are introduced:

- Hindi disappears from `I18nService.availableLanguages`, loses its native Devanagari name, or is incorrectly classified as RTL.
- `I18nService.updateDocumentLanguage()` stops synchronising document `lang` and direction from locale metadata.
- theme-specific logic is introduced into document language/direction ownership.
- representative complex-script segmentation no longer reconstructs the exact source text.
- the platform no longer treats a Devanagari base plus vowel sign as a single grapheme cluster.

The structural verifier reports the offending source path when feature code introduces a prohibited typography or line-breaking pattern.

## Accessibility and theme scope

`lang` is the key automated accessibility boundary in this verification stage because it lets screen readers select appropriate pronunciation rules. Devanagari complexity does not imply RTL, so Hindi must remain LTR even when the application supports separate RTL languages.

Light and dark states are retained in the Angular regression coverage, while the standalone gate enforces that theme logic cannot own document language/direction. Theme tokens may change colour and contrast, but they must not alter text shaping, segmentation, language identity, or direction.

No Claude Design/design-preview update is required for this ticket because the verification gate changes tests, CI, and documentation only; it does not change a rendered visual contract.

## Follow-up coverage

Rendered 390px, 200%, and 400% visual reflow remains owned by the repository-wide responsive/zoom verification programme. IME-safe command handling should be enforced at editable-control boundaries as those controls migrate; this ticket deliberately does not invent a global key-handler abstraction merely to satisfy a test.

## Rollback

Revert the commits that introduce the Devanagari regression contracts, workflow, and this document. There is no API, database, route, persistence, theme-token, or production runtime migration to undo.
