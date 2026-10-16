# 📋 Consolidated Product Backlog

_Organized by complete user outcomes rather than individual technical chores._

## 💬 1-on-1 Chat & Messaging

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Chat systems.
- Complete emoji message reactions, disappearing messages, per-user archive and hidden chat folders, and per-user priority inbox pins.
- Add swipe-to-reply gesture, edit sent messages, and hold-to-record direct R2 voice notes with playback speed controls and auto-play sequential settings.
- Complete group chat features for 2-19 members, and group participant drawer.
- Add message privacy filters based on age, gender, and native language.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations, and instant video messages.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.

## 👥 Communities & Groups

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling) (Ref: PR #8448).
- Dedicated Groups & Scheduled Events System.
- Harden Centrifugo connection token endpoint and lock connection-token contract.

## 📰 Moments & Social Feed

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments and Social feeds.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Complete production liked-by modal.
- Persist muted word filters across devices and build interactive multi-media posts (swipeable full-screen lightboxes for images and Audio Intros feed).
- Complete safe quick actions for follow lists, and chart.js integration for visual data representation.
- Harden TimelineWorker fan-out pagination and comment mention notification delivery.
- Add Moments Cypress flows, analyse reference feed screenshots, and implement x-algorithm for content recommendations.
- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.

## 👤 User Profiles & Settings

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles and Settings.
- Build comprehensive Profile Settings and UI: Cover Photo uploader aligned with Relay theme, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Add privacy-safe profile visit tracking, Who Viewed Me logs, and online/VIP status visibility controls.
- Add free-text learning goals, complete Translate Bio accessibility contract, and support detailed profile metadata (proficiency levels, 30-second Audio Introduction).
- Complete safe Data & Storage controls and private data archive and deletion lifecycle (GDPR).
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.

## 🎙️ Live Audio Rooms & Video Events

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio and Video Rooms.
- Complete centralized events discovery, centralized discovery feed, and categorise active Voicerooms.
- Complete Create Event modal, safe Attending and Interested RSVPs.
- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- Provide post-session resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.
- Complete Voice Room Active filter contract and lock host stage and audience UI contract.
- Harden TURN/STUN connectivity for corporate NATs, fix WebRTC edge cases, and fix inviteCoHost race conditions.

## 🔍 Discovery & Matchmaking

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery map and search features.
- Build Matchmaking & Discovery tools with GPS-based distance slider, dynamic Hobbies & Interests tags, and Serious Learner filter.
- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Converge discovery error actions on Spartan.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.

## 🧠 Learning & AI Tools

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Spaced Repetition (SRS) and LingQ Engine.
- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module.
- Integrate Correction Modal with SRS Flashcards, harden language correction visual diffs, and introduce Correction Quality rating system.
- Make diagnostic quiz completion durable and dynamic.
- Complete coin-funded language challenges.
- Integrate unified learner knowledge model for personalization, architectural enhancements for language learning synergy.
- Route translation and transliteration providers.
- Complete daily learning tip design sync, lock cultural tip accessibility contract.
- Make daily login rewards atomic and lock database question bank contract, foster language habits with push notification reminders and progress tracking.
- Implement advanced AI integrations: Context menu option for AI-generated grammar breakdowns, partial credit scoring for minor typos during SRS reviews, and Suggest Flashcards feature.
- Enforce daily AI usage rate limiting, strict LLM prompt injection protection, unlock premium one-off AI services, and 50/50 language exchange timers.

## 🛡️ Trust & Safety (Moderation)

- Complete production Block Management and lock ban and warn moderation endpoints.
- Enforce typed user-content sanitisation boundaries, exempt non-user-authored body fields from sanitization.
- Add ASN hosting risk controls and automated PII scrubbing.

## 👑 Monetisation & VIP

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Provide enhanced user toggles: Hide Online Status and Hide VIP Status.

## ⚙️ Platform, UI Architecture & Automation

- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- Fail closed on missing Supabase sessions and fix IDOR / secrets validation for LiveKit and Stripe.
- Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts.
- Reduce automation churn and Codex reasoning burn without lowering quality.
- Integrate diagnostic tools: custom Angular ErrorHandler logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., loading=lazy), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.
- Configure Angular Universal (SSR).
- Audit RxJS subscriptions and migrate to Angular Signals where possible.
- Agent workflow to check for security issues and vulnerabilities.
- Achievements service in NestJS.
- Stabilize Visual Diff Component (Replace naive diff with Myers, optimize segmenter, fix translation mapping, add focus visibility).
- Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat and reading views to prevent DOM bloat and UI lag (Ref: PR #8448).
  - Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
  - Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
  - Implement virtualised rendering or windowing in the reading components for extensive texts.
  - Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
  - Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
  - Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.
