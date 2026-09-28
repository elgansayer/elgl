# Appearance settings

Issue #1444 defines the user-facing **Settings → Appearance** surface. The existing implementation composes the repository's established preference services rather than introducing a parallel settings store.

## Preference contract

- **Theme** supports `system`, `light`, and `dark`. `system` follows `prefers-color-scheme` live while the app is open. Theme selection is cached locally so it can be applied before network-dependent settings are available.
- **App text size** exposes Small, Normal, and Large presets. They map to 90%, 100%, and 115% of the 16px rem baseline. The existing 80–150% `FontScaleService` range is retained for backwards compatibility and accessibility tooling.
- **Chat text size** is independent from the app text size. Small, Medium/Normal, and Large map to `0.8125rem`, `0.875rem`, and `1rem` for chat message content. It is cached locally for immediate startup and persisted through the authenticated `/chat/settings` API when Appearance settings are saved.
- **UI language** is owned by `I18nService`. Changing it must not mutate the learner's `native_languages`, `target_languages`, discovery matching, or study-plan data.
- **Primary accent** is profile-backed and available only to profiles with the existing VIP entitlement. Hiding or disabling the browser control is not an authorization boundary; backend profile validation remains authoritative.

Invalid or corrupt locally stored values are ignored. Browser storage failures do not prevent the in-memory preference from applying. A failed server save restores the previous server-backed chat text size and leaves the page in a retryable error state rather than claiming success.

## Routing and ownership

`/settings/appearance` is lazy loaded from `settings.routes.ts`. Preference ownership is deliberately split by responsibility:

- `ThemeService` owns theme and application primary-accent application;
- `FontScaleService` owns application and chat text rendering scales;
- `ChatSettingsService` owns server persistence for chat text size;
- `UserService` owns authenticated profile-backed accent persistence;
- `I18nService` owns UI-language selection.

The Appearance component coordinates those services but must not become a second source of truth for their persisted state.

## Accessibility and responsive behavior

Appearance choices are real buttons with `aria-pressed` state and at least a 44px touch target. Choice groups wrap instead of forcing a fixed row so they remain usable on narrow screens and at high browser zoom. Theme state is not conveyed by colour alone. Success and failure messages use live-region semantics.

The app text-size preference changes the root rem baseline, so layouts continue to reflow naturally instead of scaling with transforms. Chat text uses a scoped CSS custom property and does not alter navigation, settings, or other application chrome. The screen must remain usable with long translations and RTL locales.

## Privacy and security

Appearance values contain no user-generated content or credentials. Locally cached values are allow-listed before use, and theme/accent storage access is guarded against browser privacy-mode or quota exceptions. Chat text size is persisted only through the existing authenticated chat-settings endpoint. Profile-backed accent changes continue through the authenticated `UserService` boundary.

## Verification

Run the focused dependency-free product contract from the repository root:

```bash
node --test scripts/appearance-settings-contract.test.mjs
```

For Angular behavior, run the focused frontend tests before rollout:

```bash
cd frontend
npm test -- --run src/app/services/font-scale.service.spec.ts src/app/services/theme.service.spec.ts src/app/services/chat-settings.service.spec.ts src/app/pages/settings/appearance-settings/appearance-settings.component.spec.ts
```

Pull requests that change the route, Appearance component/template, product contract, or this document also run the read-only **Appearance Settings Contract** workflow. Canonical frontend unit/static-analysis/build jobs remain authoritative for compilation and runtime component coverage.

Manual checks should cover light/dark/system theme transitions, all app text presets, all chat text presets, UI-language switching, VIP/non-VIP accent state, a narrow viewport, 400% browser zoom, keyboard-only selection, blocked local storage, and a failed chat-settings save.

The contract intentionally checks product ownership instead of snapshotting exact visual classes. Failures usually indicate an eager-route regression, preference ownership drift, loss of VIP accent gating, accidental coupling of UI language to study-language profile mutation, or loss of accessible selected/save states.

## Rollout and rollback

The contract and documentation add no database migration or API change. Deploy through the normal frontend pipeline. Older clients continue to understand the existing `small | medium | large` chat text values.

To roll back an Appearance implementation change, revert the affected UI/service changes while leaving compatible local preference keys and server-side chat `textSize` values in place. If the architecture is intentionally redesigned, update this contract in the same PR so ownership, retryable failure semantics, entitlement checks, and accessibility remain explicit.
