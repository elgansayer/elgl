# Relay design evaluation - 20 October 2026

Scope: every runtime UI surface in `frontend/src/app` (204 surfaces: components, pages, Spartan Helm
controls and nested feature folders), the Relay tokens in `frontend/src/styles.scss`, and all 38
design previews. Method: full-coverage specimen catalogues built from the component templates and
their i18n keys, then `audit-design.mjs` (static) and `render-previews.mjs` (Chromium, 390px and
1280px, light/dark x LTR/RTL, computed contrast with alpha compositing, tap targets, overflow).

## Coverage

|                                                           |           Before |            After |
| --------------------------------------------------------- | ---------------: | ---------------: |
| Runtime surfaces specifically mapped to a design artefact | 26 / 187 (13.9%) | 204 / 204 (100%) |
| Preview files mapped by the manifest                      |          24 / 28 |          38 / 38 |
| Design-sync items                                         |               23 |               37 |

New catalogues: `features/{auth-access, chat-messaging, calls-live, profile-identity,
discovery-community, learning, commerce, settings-system, admin-console}.html` and
`components/primitives/helm-controls.html`. Each specimen shows the states the code really has and
flags where the runtime falls short of the design.

## Findings, highest impact first

### 1. English copy is missing or placeholder across the product (systemic)

Two English sources coexist (`I18nService.baseDictionary` in `services/i18n.service.ts` and
`assets/i18n/en*.json`), and neither is complete. `src/assets/i18n/en.json` holds 39 placeholder values
generated from key names ("Title", "Delete Button", "Export Description"). Whole namespaces have no
English at all: `forgot_password.*`, `subscription.plans/success/cancel.*`, `host_dashboard.*`,
`voices.notes.*`, `chatSearch.*`, `readReceipts.*`, `lightbox.*`, `share.*`,
`notification_customization.*`, `errorBoundary.*`, `languageIslands.*`. Users on those screens see
raw keys or placeholder words. **Fix:** one English source of truth plus a CI check that every key used
in a template resolves to non-placeholder English.

### 2. Token contrast misses WCAG AA in places DESIGN.md says it passes

Computed from `styles.scss`:

- light `text-muted` on `surface-300` 4.39:1, on `surface-400` about 4.1:1; dark `text-muted` on
  `surface-300` 3.92:1 and `surface-200` 4.20:1.
- light Ember / Tide / danger used **as text** on the page background: 4.22 / 4.25 / 4.25:1.
  These two causes account for most of the 767 render findings between 4.0 and 4.5:1. **Fix:** retune
  `text-muted` (shipped in the stacked PR); add AA-safe text roles for Ember/Tide/danger rather than
  darkening the brand fills (Factory issue).

### 3. Preview tokens used invalid CSS (fixed here)

Every preview declared tokens as `198, 82, 48`, so each `rgb(var(--x) / a)` became
`rgb(198, 82, 48 / a)`, which is invalid and silently dropped. All translucent fills, borders and
scrims in all previews rendered transparent, so reviewers were judging designs that did not match
runtime. All 34 files now use space-separated tokens, matching `styles.scss`.

### 4. Stale and off-brand previews

- `components/correction-modal.html` still carries the pre-Relay palette (secondary is violet
  `163,73,201`, not Tide) and has no dark theme; `daily-learning-tip.html` drifts on `text-muted`.
- `components/daily-login-modal.html` uses a blue CTA, not Ember.
- 19 previews do not redefine `--accent` for dark mode, and 6 primitive previews depend on the
  Tailwind CDN, so they cannot render offline.
- `components/communities.html` renders its heading and labels at about 1:1 contrast.

### 5. Runtime defects found while building the catalogues

- **Accessibility:** language-selector options all have `aria-label="Selected"`; the audio-intro play
  button has no accessible name; `admin-actions` bans and `lesson-manager` deletes without confirmation.
- **Icons and emoji:** `voip-active-call` shows the words `mic_off`, `volume_up` and `call_end`
  because no icon font is loaded. `classroomsMarketplace.title` stores HTML entities that render
  literally. Sidebar nav items and text-to-speech show their emoji twice.
- **Off-system styling:** `age-range-slider` uses non-Relay tokens and a physical `left`;
  `forced-update-modal` and `audio-intro-feed` use `text-white` instead of `on-fill`; `user-detail`
  uses neon colours for text; `share-modal` hand-rolls an overlay instead of the Helm dialog.
- **Hard-coded English:** `voip-call`, `room-chat`, `instant-video-recorder`, `device-transfer`,
  `legal-document-viewer`, the version-check error, and split-screen "(Host)" labels.
- **Unfinished surfaces:** `audio-stage` renders "audio-stage works!"; `pages/language-islands`
  renders only its title key.
- **Copy leaks infrastructure:** `voiceRecorder.uploadingBtn` mentions "Cloudflare R2".

### 6. Smaller issues

- 457 interactive elements under 44x44px at 390px, concentrated in chips, icon buttons and admin tables.
- Legacy screen previews overflow the 390px baseline by 20px (page chrome, not the design).
- 26 manifest `requiredStates` have no visible evidence in their preview (mostly RTL and
  focus-visible in the primitive previews).

## What happens next (automated)

- **Factory issues** (`design-improvement`, `factory-ready`) for findings 1, 2 (text roles) and 5.
- **Weekly:** Design System Health files deterministic findings, and the improvement agent critiques three
  rotating artefacts, files render findings, and opens preview-improvement PRs.
- **Nightly:** the Claude Design sync pushes all 37 artefacts once the host has `/design-login`.
- **Every PR:** the coverage gate keeps design coverage at 100%.

Reports: `npm run audit:design`, `npm run audit:design-render` (screenshots in `reports/design-screens/`).

## Status updates

- **28 October 2026, issue #9462:** the "Icons and emoji" and "Copy leaks infrastructure" runtime defects in
  finding 5 are fixed. `voip-active-call` draws Lucide glyphs through ng-icons, `classroomsMarketplace.title`
  stores the emoji character, the `nav.*`, `moments.readAloud` and `moments.stopReading` labels no longer repeat
  the icon the template already draws, and `voiceRecorder.uploadingBtn` no longer names the storage provider.
  The matching specimens in `features/{calls-live,chat-messaging,settings-system}.html` dropped their defect
  notes. Still open from the same findings: the missing English strings (finding 1), including
  `nav.shop`, `nav.stickerStore`, `nav.vip`, `coinEco.sectionTitle` and the `call.*` labels, because the live
  dictionary is `I18nService.baseDictionary`, not `assets/i18n/en.json`.
