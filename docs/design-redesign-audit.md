# Frontend Redesign - Phase 0 Audit

Companion to the redesign plan (`design/tokens-foundation` and onward). This is the checklist later phases close out against - see "Status" columns. Do not delete completed rows; mark them done so the initiative is auditable mid-flight if a session ends.

## 1. Claude Design sync target

Confirmed via `DesignSync.list_projects` / `get_project`:

- Project: **"HelloTalk Design System"**, `projectId: 9bc8b570-f656-4b2e-b23c-bdc776f974b1`, `type: PROJECT_TYPE_DESIGN_SYSTEM`, owned, editable. **Reuse this project - do not create a new one.**
- Existing content (as of this audit): `foundations/tokens.html`; primitives `buttons.html`, `card.html`, `chip-pill.html`, `inputs.html`, `language-badge.html`, `modal-sheet.html`, `navigation.html`, `toast.html`; screens `chat.html`, `discovery.html`, `home.html`, `onboarding.html`, `profile.html`. This reflects the _current_ dark-neon system and is a small subset of the full app (5 of ~97 routes) - the gap between this and full coverage is exactly what Phase 1/2/4 syncs close.

## 2. Primitive audit (`frontend/src/app/components/primitives/`)

| Primitive                    | Status                          | Known issue                                                                                                                                                                                     | Missing spec?          |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `app-button`                 | Bespoke, keep                   | Hardcoded off-token `bg-blue-600`/`bg-red-600`, `rounded-lg`                                                                                                                                    | No spec file - **gap** |
| `app-button-primary`         | Bespoke, keep                   | Correctly token-driven today; reskin only                                                                                                                                                       | Has spec               |
| `app-button-secondary`       | Bespoke, keep                   | Off-token focus ring (`ring-slate-400`), no-op hover state                                                                                                                                      | Has spec               |
| `app-gradient-button`        | Bespoke, keep                   | Hardcoded gradient + off-token `ring-purple-500`                                                                                                                                                | Has spec               |
| `app-card`                   | Bespoke, keep                   | Base classes fetched via `I18nService.translate('card.base_classes')` - CSS smuggled into i18n dictionary; disagrees with the parallel `.app-card` CSS class (`rounded-2xl` vs `rounded-sheet`) | Has spec               |
| `app-chip`                   | Bespoke, keep                   | Clean, token-driven, RTL-safe                                                                                                                                                                   | Has spec               |
| `app-pill`                   | Bespoke, keep                   | Colours smuggled through i18n keys (`pill.colour_X`) resolving to hardcoded Tailwind colours unrelated to the token palette                                                                     | Has spec               |
| `app-input`                  | Bespoke, keep                   | Clean, token-driven                                                                                                                                                                             | Has spec               |
| `app-textarea`               | Bespoke, keep                   | Clean, token-driven                                                                                                                                                                             | Has spec               |
| `app-empty-state`            | Bespoke, keep                   | -                                                                                                                                                                                               | Has spec               |
| `app-skeleton-loader`        | Bespoke, keep                   | -                                                                                                                                                                                               | Has spec               |
| `app-toast`                  | Bespoke, keep                   | Confirmed dead duplicate `Toast` class/selector collision - cleanup during rebuild                                                                                                              | No spec file - **gap** |
| `app-typing-indicator`       | Bespoke, keep                   | -                                                                                                                                                                                               | Has spec               |
| `app-scrollable-pills`       | Bespoke, keep                   | Hardcodes `bg-purple-600` instead of `primary` token                                                                                                                                            | Has spec               |
| `app-no-network-banner`      | Bespoke, keep                   | -                                                                                                                                                                                               | Has spec               |
| `app-language-picker`        | **Rebuild on Spartan Combobox** | Functionally a combobox already (trigger + search + list); hand-rolled keyboard/filter logic                                                                                                    | Has spec               |
| `app-fluency-indicator`      | Bespoke, keep                   | -                                                                                                                                                                                               | No spec file - **gap** |
| `app-lottie-player`          | Bespoke, keep                   | -                                                                                                                                                                                               | No spec file - **gap** |
| `app-audio-equalizer`        | Bespoke, keep                   | -                                                                                                                                                                                               | Has spec               |
| `a11y-clickable` (directive) | Keep                            | -                                                                                                                                                                                               | n/a                    |

**4 spec gaps to fill during Phase 2 regardless of rebuild scope:** `button`, `toast`, `fluency-indicator`, `lottie-player`.

## 3. Net-new primitives (capability gaps, not replacements) - Spartan/ui adoption dropped

**Decision (this session): do not adopt Spartan/ui.** Every published `@spartan-ng/brain` version,
including `1.0.0`, requires `tailwindcss >=4.0.0` (confirmed via `npm view @spartan-ng/brain@<ver>
peerDependencies` across the full version range). This repo is on Tailwind v3.4.19. There is no
Tailwind-v3-compatible Spartan release. Adopting it would require migrating the entire app from
Tailwind v3 to v4 first - a separate, high-risk, breaking-change migration (config format changes,
potential visual regressions across all ~250 components using Tailwind utility classes) that is
well outside the scope of "add a few complex primitives" and was not surfaced by the original Phase
0 audit (which only checked `@angular/cdk` compatibility, not Spartan's own peer dependencies).

**Path forward:** build Dialog/Dropdown Menu/Select/Popover/Date Picker as bespoke components
directly on `@angular/cdk` (Overlay, A11y `CdkTrapFocus`/`FocusMonitor`, `OverlayModule`) instead of
Spartan's Brain layer. CDK itself has no Tailwind version constraint and is already an installed,
idle dependency (confirmed in the original audit). This still delivers the accessibility/keyboard
correctness goal that motivated considering Spartan, without the Tailwind migration risk. If a
genuine need for Tailwind v4 arises later for unrelated reasons, Spartan can be revisited then as a
separate initiative.

Confirmed only one hand-rolled CDK usage exists today (`CdkTrapFocus` in `report-user-modal`); everything else below is fully hand-rolled with no CDK backing:

| New primitive     | Priority | First migration target                                                                                                        |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dialog            | 1        | `report-user-modal` (only current `CdkTrapFocus` site)                                                                        |
| Dropdown Menu     | 2        | audit-driven during Phase 2 (context-menu components: `long-press-context-menu`, `message-context-menu`, `chat/context-menu`) |
| Select            | 3        | audit-driven (form-like settings screens)                                                                                     |
| Popover / Tooltip | 4        | audit-driven                                                                                                                  |
| Date Picker       | 5        | audit-driven (none confirmed in use yet - lower priority unless found)                                                        |

Modal inventory to migrate onto the new Dialog primitive over Phase 2/4 (13 found): `approve-speaker-modal`, `correction-modal`, `daily-login-modal`, `forced-update-modal`, `incoming-call-modal`, `liked-by-modal`, `private-party-create-modal`, `report-user-modal`, `share-modal`, `tip-host-modal`, `trust-safety-modal`, `virtual-gift-modal`, `voiceroom-create-modal`, `word-definition-modal` (14, corrected count).

## 4. Dual styling system

`frontend/src/styles.scss`'s `@layer components` duplicates 7 primitive-shaped classes (`.app-card`, `.app-input`, `.app-textarea`, `.app-button-primary`, `.app-button-secondary`, `.app-chip`/`-active`, `.app-pill`) applied directly via `@apply` in ~60+ templates, bypassing the Angular components. Non-primitive layout helpers in the same block (`.app-screen`, `.app-padded`, `.app-section-title`, `.app-muted`, `.app-filter-scroll`, word-token classes) are **not** in scope for collapsing - no component equivalent exists or should exist for them.

Convergence tracking (Phase 3, re-run this grep periodically and update the count):

```
grep -rlE "class=\"[^\"]*\bapp-(card|input|textarea|button-primary|button-secondary|chip|pill)\b" frontend/src --include='*.html' --include='*.ts' | wc -l
```

Baseline count at audit time: ~60+ files (see exploration report; exact rebaseline recommended at Phase 3 kickoff since concurrent agent commits shift this).

## 5. Full feature inventory (for Claude Design full-coverage sync, Phase 4)

**Routes** (`frontend/src/app/app.routes.ts`, ~97 entries) grouped by feature area - sync order in Phase 4 should follow this grouping:

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

**Component folders**: 165 under `components/`, 25 under `pages/` (full alphabetical list captured in the exploration transcript this audit is based on - not duplicated here to keep this doc scannable; re-run `find frontend/src/app/components -maxdepth 1 -mindepth 1 -type d` / same for `pages` if a fresh list is needed).

**Sync coverage target**: every route above gets at least one synced screen preview; every modal in §3 gets one; every primitive in §2 gets one. Track completion as each Phase 4 feature-folder PR merges - update this doc's checkboxes (add `- [ ]`/`- [x]` per group above) as sync work actually happens, rather than leaving this as a static snapshot.

## 6a. Major finding (session 2): unresolved git conflict markers checked into `main`

While migrating `report-user-modal` and `appearance-settings` this session, found both had literal
unresolved `<<<<<<< HEAD` / `=======` / `>>>>>>> origin/main` conflict markers checked into their
`.spec.ts` files - meaning those files are syntactically broken and cannot be parsed/compiled at
all. Both were fixed as an incidental part of the work that touched them (kept both sides' tests
where they covered genuinely different things, per file).

A codebase-wide sweep (`grep -rlE "^<<<<<<< |^=======$|^>>>>>>> " frontend/src`) found **13 more
files** with the same problem, not yet fixed (out of scope for this session unless organically
touched by other design-system work):

- `components/correction-modal/correction-modal.component.html`
- `components/moderation/moderation-panel.html`
- `components/moments-feed/moments-feed.component.html`
- `components/moderation-queue/moderation-queue.component.html`
- `components/classrooms-marketplace/classrooms-marketplace.html`
- `components/settings/settings.component.ts`
- `components/trust-safety-modal/trust-safety-modal.component.spec.ts`
- `components/flashcard-deck/flashcard-deck.component.ts`
- `components/audio-room/audio-room.component.html`
- `components/admin-actions/admin-actions.component.ts`
- `pages/block-management/block-management.component.spec.ts`
- `pages/admin/blocks/admin-blocks.component.spec.ts`
- `pages/admin/admin-users.component.html`

This is a distinct problem from the design-system work (merge hygiene, not tokens/primitives) and
a likely contributor to the pre-existing `npm run build` breakage noted throughout this doc and in
memory (`project_hellotalk_build_state`). Worth a dedicated cleanup pass, separate from the redesign.

**Update (session 3, 2026-08-11): all 13 frontend files above were fixed** (commit `1dc99001` on
`design/phase4-continued`). While doing so, a sweep of `backend/src` found **10 more affected
files** with the same unresolved-conflict-marker bug, out of scope for that pass (frontend-only):
`metrics/*`, `chat/chat.controller.ts`, `audio-rooms/audio-rooms.service.ts`, `economy/*.spec.ts`,
`escrow/*` (exact list not yet re-confirmed - re-run `grep -rlE "^<<<<<<< |^=======$|^>>>>>>> "
backend/src` to get current paths before starting). Worth its own dedicated pass.

## 6. Open questions carried into Phase 1

- Exact palette/typeface direction is being designed fresh (not Claude-inspired) - see `tokens.html` sync for the proposal and review checkpoint.
- `neon` token: keep scoped to decorative/gamification use (leaderboard, streaks, gifts) per existing DESIGN.md guidance, redesigned as part of the new identity rather than dropped, since it's used non-trivially.
