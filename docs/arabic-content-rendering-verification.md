# Arabic content rendering migration verification

Status: verification contract for issue #5506 (`Spartan UI 0040`). This document implements the focused migration gate required by `docs/arabic-content-rendering.md`.

## What this gate protects

Arabic rendering depends on semantic language and direction metadata rather than feature-owned text reversal or theme-specific layout tricks. The smallest deterministic regression suite therefore locks the application-level boundary that every Relay and Spartan surface inherits:

- Arabic remains a supported RTL application language with the native label `العربية`.
- Selecting Arabic updates the root document to `lang="ar"` and `dir="rtl"` for browser bidi handling and assistive technology.
- The same language/direction semantics remain intact in both light and dark themes.
- Theme selection is independent from locale direction; switching locale must not add or remove the root `dark` class.
- Switching from Arabic back to an LTR locale restores `lang` and `dir` correctly instead of leaving stale RTL state behind.

The existing repository-wide RTL logical-properties gate remains authoritative for physical-direction regressions. This focused suite does not duplicate that scanner.

## Commands

Run the Arabic language/direction regression suite:

```bash
cd frontend
npm test -- --include src/app/services/i18n.arabic.spec.ts
```

Run the existing structural RTL gate from the repository root:

```bash
npm run check:rtl-logical-contract
```

The normal frontend unit-test and repository verification paths discover the Arabic spec automatically.

## Expected failure modes

The focused test fails when any of the following contracts regress:

- Arabic is removed from `availableLanguages`, loses its RTL metadata, or its native label is corrupted.
- `I18nService.setLanguage('ar')` stops synchronising the root `lang` or `dir` attributes.
- dark-mode state is coupled to locale changes.
- switching back to an LTR locale leaves stale Arabic language/direction metadata on the document.

The structural RTL command reports the file and prohibited physical-direction pattern when feature code introduces direction-sensitive `left`/`right`, `ml`/`mr`, `pl`/`pr`, or equivalent CSS where a logical property is required.

## Accessibility and theme scope

The root `lang` value gives assistive technology the active UI language, while `dir` gives the browser and accessibility tree the correct bidi boundary. These semantics are required independently of visual theme. The test intentionally runs the Arabic transition once with the root in light mode and once with the `dark` class present to prevent theme work from changing language or direction ownership.

Feature-level user-authored content whose direction is unknown still follows `docs/arabic-content-rendering.md`: use semantic `dir="auto"` or `<bdi>` boundaries where the data contract warrants them. This gate does not invent language metadata for content whose language is unknown.

## Design preview

No Claude Design/design-preview update is required for this ticket because the change adds verification only and does not alter a shipped visual contract. Light/dark visual appearance remains covered by the existing Relay visual-regression system; this suite protects the semantic Arabic boundary underneath those states.

## Rollback

This change adds tests and documentation only. Rollback is a normal revert of the focused commit. Do not resolve a future failure by forcing physical right alignment, reversing Arabic strings, coupling dark mode to RTL state, or removing document language metadata.
