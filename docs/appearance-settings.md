# Appearance settings

Issue #1094 defines three independent presentation preferences under **Settings → Appearance**.

## Preference contract

- **Theme** supports `system`, `light`, and `dark`. `system` follows `prefers-color-scheme` live while the app is open. Theme selection is cached locally so it can be applied before network-dependent settings are available.
- **App text size** exposes Small, Normal, and Large presets. They map to 90%, 100%, and 115% of the 16px rem baseline. The existing 80–150% `FontScaleService` range is retained for backwards compatibility and accessibility tooling.
- **Chat text size** is independent from the app text size. Small, Medium/Normal, and Large map to `0.8125rem`, `0.875rem`, and `1rem` for chat message content. It is cached locally for immediate startup and persisted through the authenticated `/chat/settings` API when Appearance settings are saved.

Invalid or corrupt locally stored values are ignored. Browser storage failures do not prevent the in-memory preference from applying. A failed server save restores the previous server-backed chat text size and leaves the page in a retryable error state rather than claiming success.

## Accessibility and responsive behavior

Appearance choices are real buttons with `aria-pressed` state and at least a 44px touch target. Choice groups wrap instead of forcing a fixed row so they remain usable on narrow screens and at high browser zoom. Theme state is not conveyed by colour alone. Success and failure messages use live-region semantics.

The app text-size preference changes the root rem baseline, so layouts continue to reflow naturally instead of scaling with transforms. Chat text uses a scoped CSS custom property and does not alter navigation, settings, or other application chrome.

## Privacy and security

Appearance values contain no user-generated content or sensitive data. Locally cached values are allow-listed before use, and theme/accent storage access is guarded against browser privacy-mode or quota exceptions. Chat text size is persisted only through the existing authenticated chat-settings endpoint.

## Verification

Run the focused frontend tests before rollout:

```bash
cd frontend
npm test -- --run src/app/services/font-scale.service.spec.ts src/app/services/theme.service.spec.ts src/app/services/chat-settings.service.spec.ts src/app/pages/settings/appearance-settings/appearance-settings.component.spec.ts
```

Manual checks should cover light/dark/system theme transitions, all app text presets, all chat text presets, a narrow viewport, 400% browser zoom, keyboard-only selection, blocked local storage, and a failed chat-settings save.

## Rollout and rollback

The change is additive and requires no database migration. Deploy frontend and backend versions using the existing chat-settings contract. Older clients continue to understand the `small | medium | large` chat text values.

To roll back, revert the Appearance UI, `FontScaleService` chat custom property, and chat-room style override. Existing `app_font_scale`, `app_theme`, and `app_chat_text_size` local keys are safe to leave in place; old clients ignore unknown keys, and the server-side chat `textSize` value remains compatible.
