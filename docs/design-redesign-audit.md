# Frontend Redesign — Phase 0 Audit

Companion to the redesign plan (`design/tokens-foundation` and onward). This is the checklist later phases close out against — see "Status" columns. Do not delete completed rows; mark them done so the initiative is auditable mid-flight if a session ends.

## 1. Claude Design sync target

Confirmed via `DesignSync.list_projects` / `get_project`:

- Project: **"HelloTalk Design System"**, `projectId: 9bc8b570-f656-4b2e-b23c-bdc776f974b1`, `type: PROJECT_TYPE_DESIGN_SYSTEM`, owned, editable. **Reuse this project — do not create a new one.**
- Existing content (as of this audit): `foundations/tokens.html`; primitives `buttons.html`, `card.html`, `chip-pill.html`, `inputs.html`, `language-badge.html`, `modal-sheet.html`, `navigation.html`, `toast.html`; screens `chat.html`, `discovery.html`, `home.html`, `onboarding.html`, `profile.html`. This reflects the _current_ dark-neon system and is a small subset of the full app (5 of ~97 routes) — the gap between this and full coverage is exactly what Phase 1/2/4 syncs close.

## 2. Primitive audit (`frontend/src/app/components/primitives/`)

| Primitive                    | Status                          | Known issue                                                                                                                                                                                     | Missing spec?          |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `app-button`                 | Bespoke, keep                   | Hardcoded off-token `bg-blue-600`/`bg-red-600`, `rounded-lg`                                                                                                                                    | No spec file — **gap** |
| `app-button-primary`         | Bespoke, keep                   | Correctly token-driven today; reskin only                                                                                                                                                       | Has spec               |
| `app-button-secondary`       | Bespoke, keep                   | Off-token focus ring (`ring-slate-400`), no-op hover state                                                                                                                                      | Has spec               |
| `app-gradient-button`        | Bespoke, keep                   | Hardcoded gradient + off-token `ring-purple-500`                                                                                                                                                | Has spec               |
| `app-card`                   | Bespoke, keep                   | Base classes fetched via `I18nService.translate('card.base_classes')` — CSS smuggled into i18n dictionary; disagrees with the parallel `.app-card` CSS class (`rounded-2xl` vs `rounded-sheet`) | Has spec               |
| `app-chip`                   | Bespoke, keep                   | Clean, token-driven, RTL-safe                                                                                                                                                                   | Has spec               |
| `app-pill`                   | Bespoke, keep                   | Colours smuggled through i18n keys (`pill.colour_X`) resolving to hardcoded Tailwind colours unrelated to the token palette                                                                     | Has spec               |
| `app-input`                  | Bespoke, keep                   | Clean, token-driven                                                                                                                                                                             | Has spec               |
| `app-textarea`               | Bespoke, keep                   | Clean, token-driven                                                                                                                                                                             | Has spec               |
| `app-empty-state`            | Bespoke, keep                   | —                                                                                                                                                                                               | Has spec               |
| `app-skeleton-loader`        | Bespoke, keep                   | —                                                                                                                                                                                               | Has spec               |
| `app-toast`                  | Bespoke, keep                   | Confirmed dead duplicate `Toast` class/selector collision — cleanup during rebuild                                                                                                              | No spec file — **gap** |
| `app-typing-indicator`       | Bespoke, keep                   | —                                                                                                                                                                                               | Has spec               |
| `app-scrollable-pills`       | Bespoke, keep                   | Hardcodes `bg-purple-600` instead of `primary` token                                                                                                                                            | Has spec               |
| `app-no-network-banner`      | Bespoke, keep                   | —                                                                                                                                                                                               | Has spec               |
| `app-language-picker`        | **Rebuild on Spartan Combobox** | Functionally a combobox already (trigger + search + list); hand-rolled keyboard/filter logic                                                                                                    | Has spec               |
| `app-fluency-indicator`      | Bespoke, keep                   | —                                                                                                                                                                                               | No spec file — **gap** |
| `app-lottie-player`          | Bespoke, keep                   | —                                                                                                                                                                                               | No spec file — **gap** |
| `app-audio-equalizer`        | Bespoke, keep                   | —                                                                                                                                                                                               | Has spec               |
| `a11y-clickable` (directive) | Keep                            | —                                                                                                                                                                                               | n/a                    |

**4 spec gaps to fill during Phase 2 regardless of rebuild scope:** `button`, `toast`, `fluency-indicator`, `lottie-player`.

## 3. Net-new Spartan/ui primitives (capability gaps, not replacements)

Confirmed only one hand-rolled CDK usage exists today (`CdkTrapFocus` in `report-user-modal`); everything else below is fully hand-rolled with no CDK backing:

| New primitive     | Priority | First migration target                                                                                                        |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dialog            | 1        | `report-user-modal` (only current `CdkTrapFocus` site)                                                                        |
| Dropdown Menu     | 2        | audit-driven during Phase 2 (context-menu components: `long-press-context-menu`, `message-context-menu`, `chat/context-menu`) |
| Select            | 3        | audit-driven (form-like settings screens)                                                                                     |
| Popover / Tooltip | 4        | audit-driven                                                                                                                  |
| Date Picker       | 5        | audit-driven (none confirmed in use yet — lower priority unless found)                                                        |

Modal inventory to migrate onto the new Dialog primitive over Phase 2/4 (13 found): `approve-speaker-modal`, `correction-modal`, `daily-login-modal`, `forced-update-modal`, `incoming-call-modal`, `liked-by-modal`, `private-party-create-modal`, `report-user-modal`, `share-modal`, `tip-host-modal`, `trust-safety-modal`, `virtual-gift-modal`, `voiceroom-create-modal`, `word-definition-modal` (14, corrected count).

## 4. Dual styling system

`frontend/src/styles.scss`'s `@layer components` duplicates 7 primitive-shaped classes (`.app-card`, `.app-input`, `.app-textarea`, `.app-button-primary`, `.app-button-secondary`, `.app-chip`/`-active`, `.app-pill`) applied directly via `@apply` in ~60+ templates, bypassing the Angular components. Non-primitive layout helpers in the same block (`.app-screen`, `.app-padded`, `.app-section-title`, `.app-muted`, `.app-filter-scroll`, word-token classes) are **not** in scope for collapsing — no component equivalent exists or should exist for them.

Convergence tracking (Phase 3, re-run this grep periodically and update the count):

```
grep -rlE "class=\"[^\"]*\bapp-(card|input|textarea|button-primary|button-secondary|chip|pill)\b" frontend/src --include='*.html' --include='*.ts' | wc -l
```

Baseline count at audit time: ~60+ files (see exploration report; exact rebaseline recommended at Phase 3 kickoff since concurrent agent commits shift this).

## 5. Full feature inventory (for Claude Design full-coverage sync, Phase 4)

**Routes** (`frontend/src/app/app.routes.ts`, ~97 entries) grouped by feature area — sync order in Phase 4 should follow this grouping:

- **Shell/nav**: home, lock, device-lock
- **Profile**: profile, profile/:userId, followers, following, visitors, business-profile, external-profile equivalents, avatar/cover-photo flows
- **Discovery/matching**: discovery, proficiency, hobby-tags, language-islands, language-parties
- **Chat**: chat, chat/:id, chat-settings, message-filters
- **Audio/video**: audio-rooms, classrooms, video-call, active-call, call-logs, preview/room/:id, voiceroom-notes/:roomId
- **Vocabulary/study**: vocabulary, decks, review, suggest-flashcards, study-buddy, study-streak, milestones, resource-library, read, diagnostic-quiz, pronunciation-feedback
- **Social**: moments, notifications, notification-preferences, groups, communities, leaderboard, favourites, events, events/calendar, join/:code
- **Settings** (8 sub-pages): settings/account, /notification, /notification-customization, /message-filters, /appearance, /privacy, /backup-restore, /linked-accounts, language, data-storage, chat-settings
- **Monetisation**: vip, subscription (+success/cancel), coins (+success/cancel), coin-economy, my-subscription, shop, sticker-store, cart, escrow, escrow/:id
- **Admin/moderation**: admin, admin/lessons, admin/moderation, admin/blocks, admin/users, host-dashboard, developer
- **Legal/support/onboarding**: terms, privacy, help, support, help-about, gdpr, onboarding, forgot-password/reset-password/change-password, device-transfer, version, account/deletion
- **Misc**: stats, ai-conversation, quests, lessons

**Component folders**: 165 under `components/`, 25 under `pages/` (full alphabetical list captured in the exploration transcript this audit is based on — not duplicated here to keep this doc scannable; re-run `find frontend/src/app/components -maxdepth 1 -mindepth 1 -type d` / same for `pages` if a fresh list is needed).

**Sync coverage target**: every route above gets at least one synced screen preview; every modal in §3 gets one; every primitive in §2 gets one. Track completion as each Phase 4 feature-folder PR merges — update this doc's checkboxes (add `- [ ]`/`- [x]` per group above) as sync work actually happens, rather than leaving this as a static snapshot.

## 6. Open questions carried into Phase 1

- Exact palette/typeface direction is being designed fresh (not Claude-inspired) — see `tokens.html` sync for the proposal and review checkpoint.
- `neon` token: keep scoped to decorative/gamification use (leaderboard, streaks, gifts) per existing DESIGN.md guidance, redesigned as part of the new identity rather than dropped, since it's used non-trivially.
