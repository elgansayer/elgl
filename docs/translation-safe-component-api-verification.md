# Translation-safe component API verification

Issue: #5502 (`Spartan UI 0036`)

This gate operationalizes the translation ownership contract in `docs/translation-safe-component-apis.md` without attempting to prove translation correctness statically.

## Command

Run from the repository root:

```bash
npm run check:translation-safe-apis
```

The command first runs focused verifier regression tests, then scans only frontend application lines added relative to `origin/main` (or `TRANSLATION_SAFE_BASE_SHA` when supplied by CI/tooling).

## Enforced migration mistakes

The verifier fails when a changed frontend template adds static English-like product or assistive copy to `aria-label`, `aria-description`, `placeholder`, or `title`, or adds a common hardcoded visible button action. It also fails when a changed generic primitive under the canonical primitive/UI paths couples an `*Key`/`translationKey` input to `I18nService` instead of accepting a resolved semantic string.

The check is intentionally changed-line scoped so existing translation debt does not block unrelated migrations. Generated/vendor files and application code outside `frontend/src/app` are not scanned.

## Intentional untranslated values

Proper nouns, protocol terms, or other deliberately untranslated static values can be documented on the same template line with the exact marker `translation-static-ok`. The marker is an explicit review signal, not a general suppression mechanism.

## Failure mode

A failure prints the affected file and the violated translation contract, then exits non-zero. The root `verify` chain runs the check before dependency-compatibility and application build/test gates, so new Spartan/Relay migrations cannot silently move product copy into generic primitives or introduce untranslated assistive labels.
