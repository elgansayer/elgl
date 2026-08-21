# Translation-safe component API standard

Issue: #5501

This document defines the canonical translation contract for Angular components participating in the Spartan UI and Relay design-system migration. It applies to reusable primitives, feature components, dialogs, forms, empty states, navigation, and any component whose visible or assistive text can vary by locale.

## Current implementation audit

The frontend already has a central `I18nService` and `TranslatePipe`, and feature templates commonly render product copy from translation keys rather than embedding English strings. Components also frequently pass translated values through accessible attributes such as `aria-label`, placeholders, titles, and status text. This is the correct direction, but migration work can accidentally move translation responsibility into low-level primitives, freeze translated strings at construction time, or add English-only labels while converting controls to Spartan.

The migration therefore needs one explicit ownership rule: **feature/product layers own semantic copy and translation keys; reusable Spartan/Relay primitives own structure, state, and styling.** A primitive must not need to know which language the application is using in order to render correctly.

## Canonical contract

### 1. Product copy stays in the translation system

User-visible product copy must come from the existing translation system unless the value is user-generated, server-provided domain data, a proper noun, or another intentionally untranslated value.

Preferred template usage:

```html
<button hlmBtn type="button" [attr.aria-label]="'profile.saveAriaLabel' | t">
  {{ 'profile.save' | t }}
</button>
```

Do not hardcode a second English accessibility label while translating the visible label.

```html
<!-- prohibited -->
<button hlmBtn type="button" aria-label="Save profile">{{ 'profile.save' | t }}</button>
```

### 2. Primitives receive semantic values, not translation-service dependencies

Reusable primitives should accept already-resolved semantic values through inputs/content projection and expose events/state through typed APIs. They should not inject `I18nService` merely to translate arbitrary feature copy.

Preferred API shape:

```ts
readonly label = input.required<string>();
readonly description = input<string>();
```

```html
<app-empty-state [title]="'search.emptyTitle' | t" [description]="'search.emptyDescription' | t" />
```

This keeps the primitive reusable in tests, Storybook/design previews, admin surfaces, and future rendering contexts without coupling it to one translation namespace.

An exception is a genuinely product-level component whose own contract is a stable application translation key. Such a component may use `TranslatePipe` internally, but this should not be introduced into generic Spartan wrappers or Relay primitives.

### 3. Never translate asynchronously into a stale field

Do not resolve translated copy once in a constructor, field initializer, or one-shot lifecycle hook when the active locale can change at runtime. Prefer template pipes, computed values that depend on the translation signal, or the established reactive `I18nService` pattern.

Preferred:

```ts
readonly heading = computed(() => {
  this.i18n.translations();
  return this.i18n.translate('settings.heading');
});
```

Avoid:

```ts
readonly heading = this.i18n.translate('settings.heading');
```

when that value is expected to update after a language change.

### 4. Translate the entire accessibility contract

Translation safety includes text that is not visually prominent. The following require the same locale behavior as visible copy when they contain product language:

- `aria-label`, `aria-description`, and labelled/described relationships
- input placeholders and validation messages
- dialog titles and descriptions
- button/tooltips/title attributes
- empty, loading, error, confirmation, and destructive-action copy
- screen-reader-only text
- progress/status announcements and live-region text

When visible text already provides an accessible name, prefer the visible text rather than duplicating a separately translated label unless extra context is necessary.

### 5. Interpolation parameters remain data

Translation APIs should receive stable keys plus named parameters. Do not construct translation keys from translated fragments or concatenate localized sentence fragments.

Preferred:

```html
{{ 'review.progress' | t: { current: currentIndex() + 1, total: reviewCards().length } }}
```

Avoid:

```ts
`${this.i18n.translate('review.current')} ${current} / ${total}`;
```

Named parameters let each locale control word order, punctuation, and grammar.

### 6. Component APIs must tolerate text expansion and complex scripts

A translation-safe API must not encode assumptions about English string length or Latin typography. Components receiving translated strings must allow wrapping/reflow unless truncation is an intentional, documented product requirement.

Use Relay tokens and logical layout utilities. Avoid fixed widths chosen to fit English labels, `white-space: nowrap` on arbitrary product copy, and physical-direction spacing that breaks RTL. Where truncation is intentional, preserve an accessible way to obtain the full value.

### 7. Keys are implementation details outside generic primitives

Do not make a generic primitive API accept `titleKey`, `labelKey`, or `translationNamespace` when a normal string input is sufficient. Doing so couples the design system to the application translation mechanism and makes composition harder.

Preferred:

```html
<app-confirm-dialog [title]="'account.deleteTitle' | t" />
```

Avoid:

```html
<app-confirm-dialog titleKey="account.deleteTitle" />
```

A feature-specific component may expose a key-oriented API only when the key itself is part of that component's domain contract and the trade-off is documented.

## Spartan/Relay migration examples

### Migrating a native button

Before:

```html
<button class="legacy-primary" [attr.aria-label]="'common.save' | t">
  {{ 'common.save' | t }}
</button>
```

After:

```html
<button hlmBtn type="button" [attr.aria-label]="'common.save' | t">{{ 'common.save' | t }}</button>
```

The migration changes ownership of interaction/styling, not ownership of product copy.

### Migrating a reusable wrapper

Do not move a feature translation into the wrapper:

```ts
// prohibited generic primitive
readonly labelKey = input.required<string>();
private readonly i18n = inject(I18nService);
```

Instead keep the wrapper semantic:

```ts
readonly label = input.required<string>();
```

and translate at composition time:

```html
<app-action-row [label]="'privacy.blockUser' | t" />
```

### Dynamic locale changes

A component that computes a list of translated choices must establish a reactive dependency on the translation state before calling `translate`:

```ts
readonly options = computed(() => {
  this.i18n.translations();
  return [
    { id: 'all', label: this.i18n.translate('filters.all') },
    { id: 'following', label: this.i18n.translate('filters.following') },
  ];
});
```

## Prohibited migration patterns

Do not introduce any of the following during Spartan conversion:

- hardcoded English product or accessibility copy in a previously translated surface
- generic primitives that inject `I18nService` solely to translate caller-owned copy
- `*Key` inputs when a resolved semantic string is sufficient
- translated values captured once where runtime locale switching is supported
- concatenated translated fragments that assume English word order
- duplicated visible and assistive labels that can drift independently
- fixed-width/nowrap assumptions that only fit the default locale
- translation keys embedded in Spartan/CSS utility classes or design tokens
- swallowing a missing translation by replacing it with unrelated English fallback copy inside a primitive

## Missing-key and fallback behavior

Missing translations should remain diagnosable through the existing translation system rather than being silently hidden by design-system components. Generic primitives should render the semantic value they receive and should not invent locale fallbacks. Feature code that has an explicit product fallback may provide it according to the established i18n policy.

A missing translation must not cause a control to lose its accessible name. Tests for critical controls should therefore assert the naming relationship or translated output expected from the test translation provider.

## Testing contract

For changed components, focused tests should cover the parts of this contract that are relevant to the surface:

1. visible product copy is sourced through the translation layer;
2. accessible names/descriptions are translated or correctly derived from visible text;
3. interpolated messages use named parameters;
4. a reactive/computed translation updates when the test translation state changes where runtime locale switching is supported;
5. long translated values can wrap/reflow without relying on a fixed English width;
6. RTL-sensitive layout uses logical direction utilities/properties.

Generic primitive tests should not need to bootstrap the application translation service merely to test labels supplied by callers.

## Verification commands

For a normal frontend migration PR, run the repository's canonical frontend gates rather than inventing a separate translation build path:

```bash
cd frontend
npm run lint:check
npm run check:template-bindings
npm run check:rtl-logical
npm test -- --run
npm run build
```

Repository CI additionally runs the canonical constitution/design-sync/component-system checks defined in `.github/workflows/ci.yml`.

## Recommended automated guard

Follow-up issue #5502 should add the smallest useful automated regression gate. The guard should focus on high-signal migration mistakes rather than attempting to prove translation correctness statically. Recommended initial checks:

- flag newly added hardcoded `aria-label`, `placeholder`, and user-visible button text in migrated product components when the repository has an equivalent translation pattern;
- flag new generic primitive inputs named `*Key`/`translationKey` when the primitive also imports the application i18n service;
- include focused component tests demonstrating reactive locale changes and long-text/RTL behavior.

The guard should support an explicit, documented allowlist for intentionally untranslated values and avoid scanning generated/vendor files.

## Review checklist

Before approving a Spartan/Relay migration that changes component APIs, verify:

- copy ownership remained at the feature/product composition layer;
- the primitive API is semantic and provider-agnostic;
- visible and assistive copy share the same locale behavior;
- interpolation is parameterized rather than concatenated;
- runtime locale changes do not leave stale computed fields;
- long translations, RTL, and complex scripts are not constrained by English-only layout assumptions;
- tests cover the changed translation contract;
- the follow-up verification gate remains compatible with this standard.

This standard deliberately keeps translation concerns orthogonal to Spartan's interaction primitives and Relay's visual tokens. That separation lets either layer evolve without forcing product copy, locale state, or translation namespaces into the component-system API.
