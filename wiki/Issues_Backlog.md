# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## 💬 1-on-1 Chat & Messaging

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Chat systems.
- Build disappearing messages (set to expire after 24 hours, 7 days, or 90 days).
- Implement audio compression and hold-to-record voice note recorder with playback speed controls.
- Enhance message interaction with edit capability, typing indicators, read receipts, and emoji reactions.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations.
- Enable direct messaging filters based on age, gender, and native language.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.
- Settings toggle to auto-play sequential voice notes.
- Automated PII scrubbing.
- Forwarding messages.
- Instant video messages.
- Pin priority chats.
- Swipe-to-reply gesture.
- WebSocket connection rate limiting.

## 👥 Group Chat & Communities

- Develop Group Chats feature allowing 2 to 19 partners to collaborate in a single thread based on specific interests, including real-time text correction tools for members.
- Dedicated Groups & Scheduled Events System.
- Complete Responsive Communities Experience:
  - Refactor to responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view.
  - Implement active state styling (Angular signals, Tailwind classes) for selected communities/groups.
  - Add micro-interactions (hover effects) and unread notification badges.
  - Extract Communities list and creation form into separate components for scalability.
  - Implement error handling (`try...catch`) and user feedback for community creation and deletion.
- Harden Centrifugo connection token endpoint and lock connection-token contract.

## 📰 Moments & Social Feed

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments and Social feeds.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word) and algorithmic recommendations (Partner of the Week).
- Build interactive multi-media posts: swipeable full-screen lightboxes for images and Audio Intros feed.
- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.
- Complete production liked-by modal.
- Persist muted word filters across devices.
- Complete safe quick actions for follow lists.
- Harden TimelineWorker fan-out pagination and comment mention notification delivery.
- Add Moments Cypress flows and analyse reference feed screenshots.
- Mute Word client-side filter.
- Correction Quality rating system.
- Recommended for You carousel.
- Has Audio Intro required filter.
- Chart.js integration for visual data representation.
- Implement x-algorithm for content recommendations.

## 👤 User Profiles & Settings

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles and Settings.
- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: Learning Goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.
- Implement advanced user controls: Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow, Block Management page, and RSVP functionality for events.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.
- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls.
- Add free-text learning goals and complete Translate Bio accessibility contract.
- Align cover photo cropper with Relay theme.
- Complete safe Data & Storage controls and complete private data archive and deletion lifecycle (GDPR).
- Hide Online Status.
- Who can see my profile toggle.

## 🎙️ Live Audio Rooms & Video

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio and Video Rooms.
- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- Provide post-session resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.
- Complete centralized events discovery and centralized discovery feed.
- Complete Create Event modal and safe Attending and Interested RSVPs.
- Complete Voice Room Active filter contract and lock host stage and audience UI contract.
- Harden TURN/STUN connectivity for corporate NATs.
- Categorise active Voicerooms.
- Fix WebRTC edge cases (Bluetooth headset interrupts).
- Fix inviteCoHost race conditions (Centrifugo events arriving out of order).

## 🔍 Discovery & Search

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery map and search features.
- Build Matchmaking & Discovery tools with GPS-based distance slider, dynamic Hobbies & Interests tags, and Serious Learner filter.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.
- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Audit and propose advanced partner discovery ranking signals.
- Converge discovery error actions on Spartan.

## 🧠 Learning, Vocabulary & AI Tools

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Spaced Repetition (SRS) and LingQ Engine.
- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module.
- Implement advanced AI integrations: Context menu option for AI-generated grammar breakdowns, partial credit scoring for minor typos during SRS reviews, and Suggest Flashcards feature.
- Foster language habits with push notification reminders, daily check-in coin rewards, and progress tracking with unlockable badges.
- Integrate Correction Modal with SRS Flashcards and harden language correction visual diffs.
- Make diagnostic quiz completion durable and dynamic.
- Complete coin-funded language challenges.
- Integrate unified learner knowledge model for personalization.
- Route translation and transliteration providers.
- Complete daily learning tip design sync and lock cultural tip accessibility contract.
- Make daily login rewards atomic and lock database question bank contract.
- Architectural Enhancements for Language Learning Synergy (integrate Pronunciation/AI with Flashcards and Reading Engine).
- Unlock premium one-off AI services.
- 50/50 language exchange timers.
- Verb conjugation trainer.
- Partial credit scoring.
- Daily AI usage rate limiting.
- Strict LLM prompt injection protection.

## 🛡️ Trust & Safety (Moderation)

- Complete production Block Management and lock ban and warn moderation endpoints.
- Enforce typed user-content sanitisation boundaries.
- Add ASN hosting risk controls.

## 👑 Monetisation & VIP

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Provide enhanced user toggles: Hide Online Status and Hide VIP Status.

## ✨ Feature Enhancements & Platform Architecture

- Integrate diagnostic tools: Dynamic diagnostic quiz component for new sign-ups and custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.
- Optimize performance for data-heavy views by implementing virtual scrolling (Angular CDK) in Chat and Reading screens:
  - Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
  - Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
  - Implement virtualised rendering or windowing in the reading components for extensive texts.
  - Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
  - Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
  - Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.
- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- Fail closed on missing Supabase sessions and fix IDOR / secrets validation for LiveKit and Stripe.
- Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts.
- Reduce automation churn and Codex reasoning burn without lowering quality.
- Implement missing E2E test flows for Authentication, Chat Messaging, and Moment Creation.
- Exempt non-user-authored body fields from sanitization.
- Configure Angular Universal (SSR).
- Audit RxJS subscriptions and migrate to Angular Signals where possible.
- Implement TimelineWorker backend job for fan-out processing.
- Agent workflow to check for security issues and vulnerabilities.
- Automated push notification reminders.
- Achievements service in NestJS.
- Stabilize Visual Diff Component (Replace naive diff with Myers, optimize segmenter, fix translation mapping, add focus visibility).
