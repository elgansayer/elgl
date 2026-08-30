# 📋 Consolidated Product Backlog

_Organized by complete user outcomes rather than individual technical chores._

## 💬 1-on-1 Chat & Messaging

- Complete emoji message reactions, disappearing messages, per-user archive and hidden chat folders, and per-user priority inbox pins.
- Add swipe-to-reply gesture and hold-to-record direct R2 voice notes.
- Complete group chat features for 2-19 members, and group participant drawer.
- Add message privacy filters.

## 👥 Communities & Groups

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling):
  - Refactor to responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view.
  - Implement active state styling (Angular signals, Tailwind classes) for selected communities/groups.
  - Add micro-interactions (hover effects) and unread notification badges.
  - Extract Communities list and creation form into separate components for scalability.
  - Implement error handling (`try...catch`) and user feedback for community creation and deletion.
- Harden Centrifugo connection token endpoint and lock connection-token contract.

## 📰 Moments & Social Feed

- Complete production liked-by modal.
- Persist muted word filters across devices.
- Complete safe quick actions for follow lists.
- Harden TimelineWorker fan-out pagination and comment mention notification delivery.
- Add Moments Cypress flows and analyse reference feed screenshots.

## 👤 User Profiles & Settings

- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls.
- Add free-text learning goals and complete Translate Bio accessibility contract.
- Align cover photo cropper with Relay theme.
- Complete safe Data & Storage controls and complete private data archive and deletion lifecycle (GDPR).

## 🎙️ Live Audio Rooms & Video Events

- Complete centralized events discovery and centralized discovery feed.
- Complete Create Event modal and safe Attending and Interested RSVPs.
- Complete Voice Room Active filter contract and lock host stage and audience UI contract.
- Harden TURN/STUN connectivity for corporate NATs.

## 🔍 Discovery & Matchmaking

- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Audit and propose advanced partner discovery ranking signals.
- Converge discovery error actions on Spartan.

## 🧠 Learning & AI Tools

- Integrate Correction Modal with SRS Flashcards and harden language correction visual diffs.
- Make diagnostic quiz completion durable and dynamic.
- Complete coin-funded language challenges.
- Integrate unified learner knowledge model for personalization.
- Route translation and transliteration providers.
- Complete daily learning tip design sync and lock cultural tip accessibility contract.
- Make daily login rewards atomic and lock database question bank contract.

## 🛡️ Trust & Safety (Moderation)

- Complete production Block Management and lock ban and warn moderation endpoints.
- Enforce typed user-content sanitisation boundaries.
- Add ASN hosting risk controls.

## ⚙️ Platform, UI Architecture & Automation

- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- Fail closed on missing Supabase sessions and fix IDOR / secrets validation for LiveKit and Stripe.
- Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts.
- Reduce automation churn and Codex reasoning burn without lowering quality.
- Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat and reading views to prevent DOM bloat and UI lag.
  - Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
  - Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
  - Implement virtualised rendering or windowing in the reading components for extensive texts.
  - Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
  - Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
  - Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.
