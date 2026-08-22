# CJK rendering migration verification

Status: verification contract for `[Spartan UI 0038]` / issue #5504. This document implements the follow-up gate defined by `docs/multilingual-typography.md`.

## What the gate protects

CJK language content must keep browser-native shaping and line breaking, inherit the universal Relay typography stack, and preserve accurate document language semantics. The migration gate therefore protects the highest-value rules that can be checked cheaply and deterministically in CI:

- Known multilingual and user-authored surfaces may not use Tailwind `break-all` for ordinary prose. CJK line wrapping stays browser-native; machine-like tokens must be handled on a narrower element.
- Language-content typography and wrapping may not change under `dark:` variants. Light and dark themes may change semantic colour and contrast, but not font selection, whitespace handling or line-breaking behaviour.
- Japanese (`ja`), Mandarin Chinese (`zh`) and Korean (`ko`) remain horizontal LTR application languages.
- Switching to a CJK UI locale must update the root document `lang` attribute so assistive technology receives the active language identity.

The static rules are deliberately theme-neutral, so the same typography and wrapping contract is enforced in both light and dark themes. Theme-specific visual colour coverage remains owned by the normal Relay visual-regression suite.

## Commands

Run the static migration gate:

```bash
cd frontend
npm run check:multilingual-typography
```

Run the focused accessibility/language-identity tests:

```bash
cd frontend
npm test -- --include src/app/services/i18n.cjk.spec.ts
```

The standard frontend verification path also executes these protections: `lint:check` invokes `check:multilingual-typography`, while the normal unit-test job discovers the CJK spec.

## Expected failure modes

A language-content source using `break-all` fails with a message similar to:

```text
language-content prose must not use break-all; preserve browser-native CJK line breaking
```

A language-content source applying theme-specific typography/wrapping fails with:

```text
CJK typography and wrapping must remain theme-neutral
```

A regression that stops synchronising the UI locale to the document, marks a CJK locale RTL, or removes a supported CJK locale fails `i18n.cjk.spec.ts` with the exact language code involved.

## Scope and intentional limits

This gate does not mechanically require `lang` on every user-authored string. Content language can legitimately be unknown, and inventing language metadata would be worse than an explicit unknown state. Component-level `lang` boundaries should be added and tested when a feature has authoritative source/target language metadata.

The gate also does not prohibit `overflow-wrap: anywhere` or narrow machine-token handling. Those are valid for URLs, opaque IDs and other unbounded tokens when applied to the token rather than weakening wrapping rules for an entire language-content paragraph.

IME composition behaviour remains an input-component responsibility. Enter-based submit/search handlers must continue to respect `KeyboardEvent.isComposing`; focused component tests should be added whenever such a handler is introduced or migrated.

## Rollback

This change adds only verification and tests. Rollback is a normal revert of the gate commit. Do not work around a failure by adding a CJK-specific font stack, forcing `break-all`, fabricating `lang` metadata, or changing CJK content to RTL.
