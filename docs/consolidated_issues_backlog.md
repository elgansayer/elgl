# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

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

- Deliver disappearing messages (set to expire after 24 hours, 7 days, or 90 days).
- Implement direct voice notes with hold-to-record, audio compression, playback speed controls, and a settings toggle for sequential autoplay.
- Enhance message interaction with edit capability, typing indicators, read receipts, emoji reactions, and a swipe-to-reply gesture.
- Provide comprehensive search functionality (client-side and server-side) across chats.
- Enable direct messaging filters based on age, gender, native language, and privacy settings.
- Empower users with AI tools in chat: conversation starter suggestions, role-play scenarios, and text simplification.
- Deliver instant video messages and photo/video sharing.
- Allow users to organize chats with priority inbox pins, archiving, and hidden folders.
- Enable message forwarding.
- Complete emoji message reactions, disappearing messages, per-user archive and hidden chat folders, and per-user priority inbox pins.
- Add swipe-to-reply gesture and hold-to-record direct R2 voice notes (with auto-play sequential voice notes).
- Enhance message interaction with edit capability, typing indicators, read receipts, and automated PII scrubbing.
- Forwarding messages and Instant video messages.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations.
- Enable direct messaging filters based on age, gender, and native language, and message privacy filters.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.

## 👥 Group Chat & Communities

- Complete Group Chats feature allowing 2 to 19 partners to collaborate in a single thread based on specific interests, including real-time text correction.
- Deliver dedicated Groups and Scheduled Events system to foster communities.

## 📰 Moments & Social Feed

- Build a unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word client-side filter, Has Audio Intro required filter) and algorithmic recommendations (Partner of the Week, Recommended for You carousel).
- Provide interactive multi-media posts: swipeable full-screen lightboxes for images and an Audio Intros feed.
- Implement AI Pronunciation Scoring service for spoken audio in posts.
- Complete production liked-by modal and safe quick actions for follow lists.

## 👤 User Profiles & Settings

- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: free-text Learning Goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.
- Empower users with advanced data controls: Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow, and Block Management.
- Add privacy-safe profile visit tracking, Who Viewed Me logs, and online/VIP status visibility toggles.

## 🎙️ Live Audio Rooms & Video Events

- Deliver centralized events discovery, events feed, and a Create Event modal with Attending and Interested RSVPs.
- Implement Private Parties (VIP/Pro tier) and a split-screen video layout for Invite Co-Host features.
- Provide Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and a live chat comment overlay.
- Provide post-session resources: AI-generated Session Summaries and on-the-fly video transcoding for class replays.
- Complete group chat features for 2-19 members, and group participant drawer.
- Dedicated Groups & Scheduled Events System.
- Complete Responsive Communities Experience (Ref: PR #8448):
  - Refactor to responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view.
  - Implement active state styling (Angular signals, Tailwind classes) for selected communities/groups.
  - Add micro-interactions (hover effects) and unread notification badges.
  - Extract Communities list and creation form into separate components for scalability.
  - Implement error handling (`try...catch`) and user feedback for community creation and deletion.

- Harden Centrifugo connection token endpoint and lock connection-token contract.

## 📰 Moments & Social Feed

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments and Social feeds.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Complete production liked-by modal.
- Persist muted word filters across devices and build interactive multi-media posts (swipeable full-screen lightboxes for images and Audio Intros feed).
- Complete safe quick actions for follow lists, and chart.js integration for visual data representation.
- Harden TimelineWorker fan-out pagination and comment mention notification delivery.
- Add Moments Cypress flows, analyse reference feed screenshots, and implement x-algorithm for content recommendations.

- Persist muted word filters across devices (Mute Word client-side filter).
- Complete safe quick actions for follow lists.
- Harden TimelineWorker fan-out pagination and comment mention notification delivery.
- Add Moments Cypress flows and analyse reference feed screenshots.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Has Audio Intro required filter) and algorithmic recommendations (Partner of the Week, Recommended for You carousel, x-algorithm for content recommendations).
- Build interactive multi-media posts: swipeable full-screen lightboxes for images and Audio Intros feed.

- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.

## 👤 User Profiles & Settings

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles and Settings.
- Build comprehensive Profile Settings and UI: Cover Photo uploader aligned with Relay theme, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Add privacy-safe profile visit tracking, Who Viewed Me logs, and online/VIP status visibility controls.
- Add free-text learning goals, complete Translate Bio accessibility contract, and support detailed profile metadata (proficiency levels, 30-second Audio Introduction).
- Complete safe Data & Storage controls and private data archive and deletion lifecycle (GDPR).
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.

- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls (Hide Online Status, Who can see my profile toggle, Hide VIP Status).
- Add free-text learning goals and complete Translate Bio accessibility contract.
- Align cover photo cropper with Relay theme.
- Complete safe Data & Storage controls and complete private data archive and deletion lifecycle (GDPR).
- Build comprehensive Profile Settings and UI: Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: proficiency levels (`a1` to `c2`) and 30-second Audio Introduction.


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

- Categorise active Voicerooms.
- Harden TURN/STUN connectivity for corporate NATs and fix WebRTC edge cases (Bluetooth headset interrupts).
- Fix inviteCoHost race conditions (Centrifugo events arriving out of order).
- Provide post-session resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.


## 🔍 Discovery & Search

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery map and search features.
- Build Matchmaking & Discovery tools with GPS-based distance slider, dynamic Hobbies & Interests tags, and Serious Learner filter.
- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Converge discovery error actions on Spartan.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.

- Build Matchmaking & Discovery tools with explicit GPS-based distance slider, dynamic Hobbies & Interests tags, and persisted Serious Learner filtering.
- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Converge discovery error actions on Spartan.
- Build Matchmaking & Discovery tools with GPS-based distance slider and dynamic Hobbies & Interests tags.


## 🧠 Learning, Vocabulary & AI Tools

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

- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module.
- Enhance flashcard grading with haptic feedback and partial credit scoring for minor typos.
- Implement advanced AI integrations: Context menu option for AI-generated grammar breakdowns, unlockable premium one-off AI services, and Suggest Flashcards feature.
- Foster language habits with automated push notification reminders, daily check-in coin rewards, daily learning tips, and progress tracking with unlockable badges.
- Deliver dynamic diagnostic quizzes for new sign-ups to build unified learner knowledge models.
- Support language exchange with 50/50 timers.
- Integrate Correction Modal with SRS Flashcards and ensure high-quality visual diffs for language corrections.

## 👑 Monetisation & VIP

- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.
- Deliver Pro subscription tier offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.
- Support robust purchasing mechanisms, Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction.

## 🛡️ Trust & Safety (Moderation)

- Ensure platform safety with automated PII scrubbing and content sanitisation boundaries.
- Implement strict moderation tools: ban and warn endpoints, block management, and ASN hosting risk controls.
- Secure platform architecture against vulnerabilities such as strict LLM prompt injection, missing auth bounds, and API throttling.
- Integrate Correction Modal with SRS Flashcards and harden language correction visual diffs.
- Stabilize Visual Diff Component (Replace naive diff with Myers, optimize segmenter, fix translation mapping, add focus visibility).
- Make diagnostic quiz completion durable and dynamic.
- Complete coin-funded language challenges.
- Integrate unified learner knowledge model for personalization (Architectural Enhancements for Language Learning Synergy).
- Route translation and transliteration providers.
- Complete daily learning tip design sync and lock cultural tip accessibility contract.
- Make daily login rewards atomic and lock database question bank contract.
- 50/50 language exchange timers and verb conjugation trainer.
- partial credit scoring.
- daily AI usage rate limiting and strict LLM prompt injection protection.
- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, and IPA alphabet module.
- Foster language habits with push notification reminders and progress tracking with unlockable badges (Achievements service in NestJS).


## 🛡️ Trust & Safety (Moderation)

- Complete production Block Management and lock ban and warn moderation endpoints.
- Enforce typed user-content sanitisation boundaries, exempt non-user-authored body fields from sanitization.
- Add ASN hosting risk controls and automated PII scrubbing.

## 👑 Monetisation & VIP

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Provide enhanced user toggles: Hide Online Status and Hide VIP Status.

- Enforce typed user-content sanitisation boundaries (Exempt non-user-authored body fields from sanitization).
- Add ASN hosting risk controls.
- Agent workflow to check for security issues and vulnerabilities.

## 👑 Monetisation & Premium Features

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Sticker Store UI, and animated sticker packs.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.
- unlock premium one-off AI services.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.


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

- Implement missing E2E test flows for Authentication, Chat Messaging, and Moment Creation.
- Configure Angular Universal (SSR).
- Audit RxJS subscriptions and migrate to Angular Signals where possible.
- Chart.js integration for visual data representation.
- Integrate diagnostic tools: custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.

- Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat and reading views to prevent DOM bloat and UI lag (Ref: PR #8448).
  - Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
  - Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
  - Implement virtualised rendering or windowing in the reading components for extensive texts.
  - Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
  - Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
  - Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.
