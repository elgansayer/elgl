# Appearance settings

Issues #1444, #1736 and #1820 define the user-facing **Settings → Appearance** surface at `/settings/appearance`. The implementation composes the repository's established preference services rather than introducing a parallel settings store.

## Preference contract

- **Theme** supports `system`, `light`, and `dark`. `system` follows `prefers-colour-scheme` live while the app is open. Theme selection is cached locally so it can be applied before network-dependent settings are available.
- **App text size** exposes Small, Medium, and Large presets (stored internally as `small`, `normal`, `large`). They map to 90%, 100%, and 115% of the 16px rem baseline. The existing 80–150% `FontScaleService` range is retained for backwards compatibility and accessibility tooling. It is a device preference and is not sent to the server.
- **Chat text size** is independent from the app text size. Small, Medium, and Large map to `0.8125rem`, `0.875rem`, and `1rem` for chat message content through the `--chat-message-font-size` custom property. It is cached locally for immediate startup and persisted per account (see [API contract](#api-contract)). A sample message under the buttons follows the same property, so the choice is visible before opening a chat.
- **UI language** is exposed here as a link to `/settings/language`. That dedicated page applies changes through `UiLanguagePreferenceService`, backed by `I18nService`, and must not mutate the learner's `native_languages`, `target_languages`, discovery matching, or study-plan data.
- **Primary accent** is profile-backed and available only to profiles with the existing VIP entitlement. Hiding or disabling the browser control is not an authorization boundary: `PATCH /users/me` rejects `primary_accent_color` for non-VIP accounts and validates the `#rrggbb` format, and that backend validation remains authoritative.

Invalid or corrupt locally stored values are ignored. Browser storage failures do not prevent the in-memory preference from applying.

## API contract

Chat text size reuses the authenticated chat settings endpoint; there is no second persistence contract.

| Request                  | Body                                                               | Result                                                                                           |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GET /api/chat/settings` | none                                                               | `200` with `autoTranslate`, `readReceipts`, `enterToSend`, `textSize`, `disappearingMessagesTtl` |
| `PUT /api/chat/settings` | any subset of the same keys, for example `{ "textSize": "large" }` | `200` with the full merged settings                                                              |

- `textSize` is one of `small`, `medium`, `large`. Anything else (another string, a different case, a number) is rejected with `400` before anything is stored, and so is any unknown property. The global validation pipe runs with `whitelist` and `forbidNonWhitelisted`, so a caller can never supply a user identifier: the account always comes from the verified session.
- An unset or unrecognised stored value is read back as `medium`, so a corrupted row degrades to the default instead of failing the request.
- `401` is returned without a valid session. A storage failure returns a sanitised `503` (`Chat settings are temporarily unavailable` or `Chat settings could not be updated`) that never echoes the provider message.
- The Appearance page sends only the key it owns (`{ "textSize": ... }`). The server merges the supplied keys onto the stored row, so saving Appearance does not reset Auto-translate, Read receipts, Enter to send or the disappearing-message default, and saving those does not reset the text size.
- The endpoint is idempotent: repeating a request with the same body leaves the same stored state, so retries are safe.

### Data, retention and concurrency

- The value lives in the existing `users.chat_preferences` JSON column beside the other chat preferences. There is no new table, column, index or migration, so no schema change needs coordinating with the generated type snapshot.
- It follows the account lifecycle. Deleting the account removes the row and the preference with it; there is no separate retention period.
- Each write is a read of the current row followed by one update, not a single atomic statement. Two writes for the same account that land within the same few milliseconds could therefore lose one of them. Clients send only the key they own, which keeps the practical exposure to two devices saving different settings at the same instant. A stricter guarantee needs a database-side atomic JSON merge function, which is a migration plus a regenerated type snapshot and is deliberately left out of this change.
- The Settings hub no longer carries its own chat text size selector. It used to save the value it had loaded when the hub opened, so a stale hub could overwrite what Appearance had saved. Appearance is the only writer; the hub links to it.
- **Reset to defaults** on the Chat settings page restores the message-behaviour settings only. It neither sends nor locally changes the text size.

### Observability

A failed read or write of the stored preferences logs one structured warning, `chat_settings_store_failure`, with the `operation` (`read` or `write`) and the provider error code (`unknown` when none is supplied). It deliberately omits the account identifier, the submitted values and the provider message, so a failure can be correlated by time and request without exposing personal data. Nothing is logged on success.

## Page states and failure behaviour

The page reads two server-backed inputs when it opens: the profile (VIP entitlement and stored accent) and the chat settings (stored chat text size). They load in parallel.

- **Loading:** a polite loading message replaces the form.
- **Ready:** every control is available.
- **Unavailable:** if either input cannot be read, an alert explains it and offers **Retry**, which reloads both. Until they load, the chat text size buttons, the accent controls and **Save** are disabled, because there is no stored value to compare with or roll back to and a choice made now could never be saved. Theme and app text size keep working because they are device preferences. An unreadable profile is never presented as "VIP required": the entitlement is unknown, so that badge is hidden.
- **Save:** the accent and the chat text size are separate stores, so they save independently and only when they differ from the stored value. Pressing **Save** with nothing changed confirms without a request, and a second press while a save is in flight is ignored.
- **Partial failure:** if one write fails the other still applies. A rejected accent write is reported as an error and the accent is not applied; a rejected chat text size write restores the size the server still holds. The error is retryable, and pressing **Save** again repeats only what is still unsaved.
- **Accent writes report only what the server confirmed.** The page persists the accent through `UserService.updateMyProfile`, which rejects when the server refuses or loses the write, so a rejected change surfaces as a save error instead of a false success.
- **Validation:** the custom accent field accepts only `#rrggbb`. A half-typed or malformed value shows an inline message (`aria-invalid` plus `aria-describedby`) and disables **Save** instead of being sent to the server. The native colour picker keeps showing the last complete colour while the field is being edited.
- **Entitlement lost:** a user who previously had VIP may still have a stored accent. The page neither applies nor resubmits it, and restores the default accent.

All messages are translation keys resolved by the template. Nothing in the component is English text.

## Routing and ownership

`/settings/appearance` is lazy loaded from `settings.routes.ts`. Preference ownership is deliberately split by responsibility:

- `ThemeService` owns theme and application primary-accent application;
- `FontScaleService` owns application and chat text rendering scales;
- `ChatSettingsService` owns server persistence for chat text size;
- `UserService` owns authenticated profile-backed accent persistence;
- `UiLanguagePreferenceService` owns the fail-closed UI-language transaction, while `I18nService` owns the active locale and dictionary. Appearance settings only reflects the current locale and links to the dedicated selection page.

The Appearance component coordinates those services but must not become a second source of truth for their persisted state.

Server-backed values (chat text size, accent) are reconciled with the device cache whenever Appearance opens. Until then a device uses its last cached value, so a change made on another device appears here the next time this page is visited.

## Accessibility and responsive behaviour

Appearance choices are real buttons with `aria-pressed` state and at least a 44px touch target. Choice groups wrap instead of forcing a fixed row so they remain usable on narrow screens and at high browser zoom. Theme state is not conveyed by colour alone. The selected accent swatch is also larger and gets a theme-aware outline, and each swatch has a readable name (for example "Select colour Ember") instead of a hex code. Success messages use `role="status"` and failures use `role="alert"`. Decorative glyphs are hidden from assistive technology, and the back and forward arrows mirror in right-to-left layouts.

The app text-size preference changes the root rem baseline, so layouts continue to reflow naturally instead of scaling with transforms. Chat text uses a scoped CSS custom property and does not alter navigation, settings, or other application chrome. The screen must remain usable with long translations and RTL locales.

## Privacy and security

Appearance values contain no user-generated content or credentials. Locally cached values are allow-listed before use, and theme/accent storage access is guarded against browser privacy-mode or quota exceptions. Chat text size is persisted only through the existing authenticated chat-settings endpoint, and the accent only through the authenticated `UserService` boundary. Neither is logged.

## Verification

Run the focused dependency-free product contract from the repository root. It covers routing, ownership, the VIP guard, honest accent saves, the unavailable-state controls, dictionary coverage for every key the page renders, the hub no longer owning chat text size, and the frontend and backend agreeing on the preset list:

```bash
node --test scripts/appearance-settings-contract.test.mjs
```

For Angular behaviour, run the focused frontend tests before rollout. The `copy` spec renders the page with the real dictionary and fails on any key that would show to users as raw text:

```bash
cd frontend
npx ng test --no-watch \
  --include 'src/app/pages/settings/appearance-settings/**/*.spec.ts' \
  --include 'src/app/components/settings/settings.component.chat-text-size.spec.ts' \
  --include 'src/app/services/chat-settings.service.spec.ts' \
  --include 'src/app/services/user.service.profile-update.spec.ts' \
  --include 'src/app/services/font-scale.service.spec.ts' \
  --include 'src/app/services/theme.service.spec.ts' \
  --include 'src/app/services/i18n.service.spec.ts'
```

For the API, run the backend unit and end-to-end specs:

```bash
cd backend
npx vitest run src/chat/chat-settings.service.spec.ts src/chat/chat-settings.controller.spec.ts src/chat/dto/chat-settings.dto.spec.ts
npm run test:e2e -- test/chat-settings.e2e-spec.ts
```

Pull requests that change the route, Appearance component/template, hub, dictionary, chat settings DTO or service, product contract, or this document also run the read-only **Appearance Settings Contract** workflow. Canonical frontend unit/static-analysis/build jobs remain authoritative for compilation and runtime component coverage.

Manual checks should cover light/dark/system theme transitions, all app text presets, all chat text presets (including the sample message), UI-language switching, VIP/non-VIP accent state, an invalid hex value, a narrow viewport, 400% browser zoom, keyboard-only selection, blocked local storage, an offline load with Retry, and a failed save.

The contract intentionally checks product ownership instead of snapshotting exact visual classes. Failures usually indicate an eager-route regression, preference ownership drift, loss of VIP accent gating, a missing translation key, accidental coupling of UI language to study-language profile mutation, or loss of accessible selected/save states.

## Rollout and rollback

The change adds no database migration. It does change the API: `PUT /api/chat/settings` and `GET /api/chat/settings` now accept and return `textSize`. Deploy the backend with or before the frontend. A new frontend against an older backend cannot save the chat text size (the older validation rejects the unknown property with `400`); the page reports a retryable error and everything else keeps working, so there is no data risk.

To roll back, revert the affected UI/service changes. Compatible local preference keys stay in place. If only the backend is reverted, the older service rewrites `chat_preferences` with the keys it knows, so the next chat setting saved from any client drops the stored `textSize`. That is harmless: the device keeps its cached size and the account falls back to `medium` until it is chosen again. No data repair is needed. If the architecture is intentionally redesigned, update this contract in the same PR so ownership, retryable failure semantics, entitlement checks, and accessibility remain explicit.
