# Privacy settings hub

Issue #1448 owns the user-facing privacy hub at **Settings → Privacy** (`/settings/privacy`). The hub does not introduce a second privacy model; it composes the repository's existing profile-visibility, block-management, personal-data, account-deletion, privacy-policy, and muted-word boundaries into one discoverable surface.

## Hub contract

The hub exposes these stable destinations:

- **Blocked users** → `/blocks`
- **Download personal data** → `/gdpr`
- **Account deletion** → `/account/deletion`
- **Privacy policy** → `/privacy`

The blocked-users destination may display the current blocked-user count as supporting information. Navigation stays on native Angular router links so keyboard activation, browser link semantics, and assistive-technology behavior are preserved.

## Profile visibility

Profile visibility is an authenticated server-backed preference with three allow-listed values:

- `everyone`
- `vips_only`
- `hidden`

The hub loads the current value through `GET /users/me/privacy-settings` and persists changes through `PATCH /users/me/privacy`. The UI uses the repository-owned Spartan radio-group primitive, exposes loading/saving/error status, rejects invalid values, prevents overlapping writes, and rolls the visible selection back if persistence fails.

The browser preference is not the authorization boundary. Backend profile/discovery services remain responsible for enforcing visibility when another user requests a profile or discovery result.

## Muted words

Muted words are a client-side content-filter preference owned by `SafetyService`. Values are normalized, de-duplicated, and stored under an account-scoped browser-storage key rather than one device-global key. Anonymous state uses a separate namespace. Storage access is best-effort so blocked/private-mode storage does not make the privacy page unusable.

Muted words are not transmitted by the privacy hub and must not be logged as diagnostics because they are user-authored filtering choices.

## Blocked-user count

`BlockedUsersService` owns the detailed blocked-user list. The privacy hub consumes only the current list length for its navigation summary; `/blocks` remains the authoritative management surface. A count is supporting UI only and must never be used as an authorization decision.

## Accessibility and responsive behavior

- The page has a single visible Privacy heading and native Back action.
- Profile visibility is represented as one labelled radio group rather than independent toggle buttons.
- Loading, save, and failure states use status/alert semantics.
- Hub destinations remain native links and expose translated title/description content.
- Muted-word add/remove controls remain keyboard-operable and have accessible names.
- Layout uses logical inline spacing and wrapping so the hub remains usable in RTL locales, narrow viewports, and browser zoom/reflow scenarios.
- No privacy state is conveyed by colour alone.

## Privacy and security

The hub must not infer or fabricate server-backed privacy values after an authenticated request fails. Profile-visibility writes fail visibly and roll back. Block counts are informational only. Authentication tokens remain owned by the existing authenticated service boundaries and must never be rendered into the page or diagnostics.

Account deletion and personal-data export remain separate dedicated flows because they have materially different confirmation, retention, and security requirements.

## Verification

Run the focused component regression suite:

```bash
cd frontend
npm test -- --run src/app/pages/settings/privacy-settings/privacy-settings.component.spec.ts
```

Then run the normal frontend verification used by pull requests:

```bash
npm run lint:check
npm run build
```

The component suite locks the hub destinations, visible destination metadata, blocked-user count, profile-visibility load/save/rollback behavior, muted-word actions, keyboard-focusable navigation, and Back behavior.

## Rollout and rollback

No schema migration or API shape change is required. The hub composes existing privacy services and routes, so rollout is a normal frontend deployment.

Rollback may revert the hub presentation or its regression coverage. It must not weaken backend profile-visibility enforcement, block relationships, GDPR export controls, or account-deletion authorization. Existing persisted profile-visibility and account-scoped muted-word values are safe to leave in place.
