# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## 💬 1-on-1 Chat & Messaging
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Chat systems.
- Complete emoji message reactions, disappearing messages (set to expire after 24 hours, 7 days, or 90 days), per-user archive and hidden chat folders, and per-user priority inbox pins.
- Add swipe-to-reply gesture, edit capability, typing indicators, read receipts, and hold-to-record direct R2 voice notes with playback speed controls.
- Complete group chat features for 2-19 members, group participant drawer, and real-time text correction tools.
- Add message privacy filters (age, gender, native language).
- Implement search functionality (client-side and server-side) within individual chats or across all conversations.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.

## 👥 Communities & Groups
- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling):

## 1-on-1 Chat & Messaging

- **Enhanced Message Interactions:** Complete emoji message reactions, disappearing messages (24h/7d/90d), edit sent messages, swipe-to-reply gestures, forwarding messages, typing indicators, and read receipts.
- **Voice & Media:** Implement hold-to-record voice notes with playback speed controls, settings toggle to auto-play sequential voice notes, instant video messages, and audio compression.
- **Organization & Search:** Add per-user archive, hidden chat folders, per-user priority inbox pins, and comprehensive search functionality within chats and across all conversations.
- **Privacy & Safety:** Enable direct messaging filters based on age, gender, and native language, plus automated PII scrubbing.
- **AI Chat Tools:** Provide conversation starter suggestions, role-play scenarios, and "Simplify this text" options in chat.
- **Performance & Stability:** Implement virtual scrolling for data-heavy chat views, and WebSocket connection rate limiting.
## 💬 1-on-1 Chat & Direct Messaging
- **Rich Message Interactions:** Add swipe-to-reply gesture, edit sent messages, typing indicators, read receipts, and emoji reactions.
- **Voice & Media Messaging:** Implement audio compression, hold-to-record direct R2 voice notes with playback speed controls, settings toggle to auto-play sequential voice notes, and instant video messages.
- **Chat Management & Privacy:** Implement disappearing messages (24h, 7d, or 90d expiration), per-user archive/hidden chat folders, pin priority chats, message privacy filters, and direct messaging filters based on age, gender, and native language. Includes automated PII scrubbing.
- **Search & Utilities:** Implement search functionality (client-side and server-side) across chats, and message forwarding.
- **AI Chat Tools:** Provide conversation starter suggestions, role-play scenarios, and "Simplify this text" options.
- **Stabilization & Foundation:** Harden Centrifugo connection token endpoint, implement WebSocket connection rate limiting, and complete End-to-end encrypted voice calls. Ensure robust error handling, security audits (GDPR, RLS), testing (Vitest, Cypress), and Datadog/Prometheus monitoring.
- **Performance Optimisation:** Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat views.


## 👥 Communities & Group Chat
- **Group Communication:** Complete group chat features for 2-19 members, including group participant drawer, and real-time text correction tools for members.
- **Responsive Communities Experience:** Refactor to a responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view (Ref: PR #8448). Include active state styling (Angular signals, Tailwind classes), hover effects, unread notification badges, and extracted Communities list/creation forms with robust error handling.
- **Events & Discovery:** Complete Dedicated Groups, centralized events discovery, Create Event modal, and safe Attending/Interested RSVPs.

## 📰 Moments & Social Feed
- **Interactive Multi-media Posts:** Build swipeable full-screen lightboxes for images, Audio Intros feed, and complete the production liked-by modal.
- **Feed Discovery & Curation:** Enhance feeds with advanced filters (Serious Learner mode, Interests, Mute Word with cross-device persistence, Has Audio Intro) and algorithmic content recommendations (Partner of the Week, Recommended for You carousel, x-algorithm).
- **Notifications & Engagement:** Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers. Harden TimelineWorker fan-out pagination and comment mention notification delivery. Complete safe quick actions for follow lists.
- **AI Integration:** Implement AI Pronunciation Scoring service for spoken audio in posts with haptic feedback.
- **Stabilization:** Add Moments Cypress flows and analyse reference feed screenshots. Complete technical foundation, security audits, and performance optimization for feeds.

## 👤 User Profiles & Settings
- **Profile Presentation:** Build comprehensive Profile Settings (Cover Photo uploader aligned with Relay theme, Appearance Settings, Dynamic Font Size slider). Support detailed profile metadata (free-text Learning Goals, proficiency levels a1 to c2, 30-second Audio Introduction, and translated bio with accessibility contract).
- **Privacy & Safety Controls:** Build Privacy Settings hub with online and VIP status visibility controls (Hide Online Status, Hide VIP Status, Who can see my profile). Add privacy-safe profile visit tracking and Who Viewed Me logs. Complete safe Data & Storage controls, Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow.
- **Platform Analytics:** Integrate Chart.js for visual data representation. Complete missing E2E test flows for Authentication.

## 🎙️ Live Audio Rooms & Video Events
- **Room Management & Discovery:** Complete Voice Room Active filter contract and lock host stage/audience UI contract. Categorise active Voicerooms.
- **Host & Moderation Controls:** Implement Private Parties (VIP/Pro tier), split-screen video layout for Invite Co-Host features, and Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- **Audience Engagement:** Add full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- **Post-Session Resources:** Provide AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.
- **Stabilization:** Fix WebRTC edge cases (Bluetooth headset interrupts), fix inviteCoHost race conditions (Centrifugo out of order), and harden TURN/STUN connectivity for corporate NATs.

## 🔍 Discovery & Matchmaking
- **Advanced Matchmaking:** Build Discovery tools with GPS-based distance slider (Make Nearby use explicit GPS location), dynamic Hobbies & Interests tags, and 50/50 language exchange timers.
- **Serious Learner Features:** Complete persisted Serious Learner mode and standardise active Serious Learner filtering. Converge discovery error actions on Spartan.

## 🧠 Learning, Vocabulary & AI Tools
- **Interactive Flashcards & SRS:** Build Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module. Integrate Correction Modal with SRS Flashcards and harden language correction visual diffs. Provide partial credit scoring for minor typos. Implement Suggest Flashcards feature.
- **Learning Ecosystem Integration:** Integrate unified learner knowledge model for personalization. Implement Architectural Enhancements for Language Learning Synergy (integrate Pronunciation/AI with Flashcards and Reading Engine). Make diagnostic quiz completion durable and dynamic. Complete daily learning tip design sync and lock cultural tip accessibility contract. Route translation and transliteration providers.
- **Gamification & Habits:** Foster language habits with push notification reminders, daily check-in coin rewards (make atomic), language challenges, and progress tracking with unlockable badges. Add Achievements service in NestJS.
- **Performance:** Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy reading views.
- **AI Safeguards:** Implement strict LLM prompt injection protection, daily AI usage rate limiting, and unlock premium one-off AI services.

## 👑 Monetisation & VIP Economy
- **Subscription Ecosystem:** Build a Pro subscription tier (unlimited translations, advanced visitor logs, ad-free browsing). Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management.
- **Economy Integration:** Implement Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts. Complete coin-funded language challenges, Sticker Store UI, and animated sticker packs.

## 🛡️ Trust & Safety (Moderation)
- **Moderation Tools:** Complete production Block Management and lock ban/warn moderation endpoints.
- **Security & Integrity:** Enforce typed user-content sanitisation boundaries. Exempt non-user-authored body fields from sanitization. Add ASN hosting risk controls. Implement agent workflow to check for security issues and vulnerabilities. Fail closed on missing Supabase sessions and fix IDOR/secrets validation for LiveKit and Stripe. Implement Correction Quality rating system.

## ⚙️ Platform, UI Architecture & Automation
- **Design System Convergence:** Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards). Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts. Stabilize Visual Diff Component (Replace naive diff with Myers, optimize segmenter, fix translation mapping, add focus visibility).
- **Core Infrastructure Enhancements:** Configure Angular Universal (SSR), audit RxJS subscriptions and migrate to Angular Signals where possible. Optimize app infrastructure: Web Vitals audits (loading=lazy), offline support via IndexedDB, client-side image compression. Develop In-App Sharing and External Deep Linking Engine.
- **Automation & Quality:** Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts. Reduce automation churn and Codex reasoning burn without lowering quality. Implement custom Angular ErrorHandler logging client crashes to backend analytics. Implement missing E2E test flows.

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Chat systems.
- Complete emoji message reactions, disappearing messages, per-user archive and hidden chat folders, and per-user priority inbox pins.
- Add swipe-to-reply gesture and hold-to-record direct voice notes with playback speed controls and audio compression.
- Complete group chat features for 2-19 members based on specific interests, including real-time text correction tools and group participant drawer.
- Add message privacy filters based on age, gender, and native language.
- Enhance message interaction with edit capability, typing indicators, and read receipts.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.

- Add swipe-to-reply gesture and hold-to-record direct R2 voice notes with playback speed controls.
- Implement audio compression.
- Enhance message interaction with edit capability, typing indicators, read receipts.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations.
- Enable direct messaging filters based on age, gender, and native language.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and 'Simplify this text' options.
- Automated PII scrubbing.
- Forwarding messages.
- Instant video messages.

## Communities & Groups

- Complete Group Chats feature for 2-19 members to collaborate in a single thread, including real-time text correction tools and group participant drawer.
- Add message privacy filters.
- Dedicated Groups & Scheduled Events System.
- Complete Responsive Communities Experience.


- Add swipe-to-reply gesture, edit sent messages, and hold-to-record direct R2 voice notes with playback speed controls and auto-play sequential settings.
- Complete group chat features for 2-19 members, and group participant drawer.
- Add message privacy filters based on age, gender, and native language.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations, and instant video messages.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.

- Complete Responsive Communities Experience with mobile drawer, unread badges, hover effects, community creation flow and error handling.
- Dedicated Groups & Scheduled Events System.

## 👥 Communities & Group Chat

- **Group Collaboration:** Develop Group Chats feature for 2-19 partners based on specific interests, including real-time text correction tools for members, and a group participant drawer.
- **Responsive Communities Experience:** Deliver a responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) with mobile drawer view, active state styling, micro-interactions, unread badges, and extracted community creation components with robust error handling.
- **Events Integration:** Dedicated Groups & Scheduled Events System.
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

- Complete Responsive Communities Experience
  - Deliver responsive three-pane layout and mobile drawer view for seamless navigation between broad communities and specific groups
  - Introduce dynamic active state visualizations and micro-interactions (hover effects, unread notification badges)
  - Ensure error robustness during community creation and deletion for a smoother user experience

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling) (Ref: PR #8448).

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, Error Handling, extracted components for scalability)

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling) (Ref: PR #8448).

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling).

  - Refactor to responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view.
  - Implement active state styling (Angular signals, Tailwind classes) for selected communities/groups.
  - Add micro-interactions (hover effects) and unread notification badges.
  - Extract Communities list and creation form into separate components for scalability.
  - Implement error handling (`try...catch`) and user feedback for community creation and deletion.
- Dedicated Groups & Scheduled Events System.





- Harden Centrifugo connection token endpoint and lock connection-token contract.

## 📰 Moments & Social Feed


- Harden Centrifugo connection token endpoint and lock connection-token contract.


## Moments & Social Feed

- **Interactive Multimedia Posts:** Build swipeable full-screen lightboxes for images and an Audio Intros feed, including Chart.js integration for visual data representation.
- **Feed Engagement & Filtering:** Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word, "Has Audio Intro"), Recommended for You carousel, Partner of the Week, and robust algorithm-based content recommendations.
- **Social Interactions:** Build unified Notifications Area (Inbox), complete production liked-by modal, safe quick actions for follow lists, and Correction Quality rating system.

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments and Social feeds.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Complete production liked-by modal.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word) and algorithmic recommendations (Partner of the Week).
- Persist muted word filters across devices.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word) and algorithmic recommendations (Partner of the Week).
- Build interactive multi-media posts: swipeable full-screen lightboxes for images and Audio Intros feed.
- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.
- Complete safe quick actions for follow lists.

- Persist muted word filters across devices and build interactive multi-media posts (swipeable full-screen lightboxes for images and Audio Intros feed).
- Complete safe quick actions for follow lists, and chart.js integration for visual data representation.
- Harden TimelineWorker fan-out pagination and comment mention notification delivery.
- Add Moments Cypress flows, analyse reference feed screenshots, and implement x-algorithm for content recommendations.

- Persist muted word filters across devices (Mute Word client-side filter).
- Complete safe quick actions for follow lists.
- Add Moments Cypress flows and analyse reference feed screenshots.
- Correction Quality rating system.
- Recommended for You carousel.
- Has Audio Intro required filter.
- Chart.js integration for visual data representation.
- Implement x-algorithm for content recommendations.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with algorithmic recommendations (Partner of the Week).
- Build interactive multi-media posts: swipeable full-screen lightboxes for images and Audio Intros feed.

## 👤 User Profiles & Settings
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles and Settings.
- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: Learning Goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.


- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Has Audio Intro required filter) and algorithmic recommendations (Partner of the Week, Recommended for You carousel, x-algorithm for content recommendations).
- Build interactive multi-media posts: swipeable full-screen lightboxes for images and Audio Intros feed.

- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: free-text learning goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.

- Implement advanced user controls: Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow, Block Management page, and RSVP functionality for events.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.
- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls.
- Align cover photo cropper with Relay theme.

- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.

## User Profiles, Settings & Privacy

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles and Settings.
- Build comprehensive Profile Settings and UI: Cover Photo uploader aligned with Relay theme, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Add privacy-safe profile visit tracking, Who Viewed Me logs, and online/VIP status visibility controls.
- Add free-text learning goals, complete Translate Bio accessibility contract, and support detailed profile metadata (proficiency levels, 30-second Audio Introduction).
- Complete safe Data & Storage controls and private data archive and deletion lifecycle (GDPR).
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.

- **Comprehensive Profile Display:** Add free-text learning goals, proficiency levels, 30-second Audio Introduction, and translated bio with accessibility features.
- **Profile Customisation & Settings:** Cover Photo uploader aligned with Relay theme, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- **Privacy & Control:** Privacy-safe profile visit tracking ("Who Viewed Me" logs), online and VIP status visibility controls, "Who can see my profile" toggle, Personal Data Collection GDPR hub, Linked Accounts page, Block Management page, and complete private data archive/deletion lifecycle.
- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls (Hide Online Status, Who can see my profile toggle, Hide VIP Status).
- Add free-text learning goals and complete Translate Bio accessibility contract.
- Align cover photo cropper with Relay theme.
- Complete safe Data & Storage controls and complete private data archive and deletion lifecycle (GDPR).
- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: Learning Goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.
- Implement advanced user controls: Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow, Block Management page, and RSVP functionality for events.

## 🎙️ Live Audio Rooms & Video Events
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio and Video Rooms.
- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- Provide post-session resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.


- Build comprehensive Profile Settings and UI: Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: proficiency levels (`a1` to `c2`) and 30-second Audio Introduction.


- Complete centralized events discovery and centralized discovery feed.
- Complete Create Event modal and safe Attending and Interested RSVPs.

- **Centralized Event Discovery:** Build centralized events discovery and discovery feed, along with a Create Event modal and safe Attending/Interested RSVPs.
- **Host & Audience Controls:** Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand, Soundboard), lock host stage and audience UI contract, and categorize active Voicerooms.
- **Interactive Enhancements:** Quick Polls, full-screen SVG gift animations, animated audio equalizer, and live chat comment overlay.
- **Video & Room Types:** Private Parties (VIP/Pro tier), split-screen video layout for Invite Co-Host features.
- **Post-Session Value:** AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.

## Live Audio Rooms & Video Events

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio and Video Rooms.
- Complete centralized events discovery, centralized discovery feed, and categorise active Voicerooms.
- Complete Create Event modal, safe Attending and Interested RSVPs.

- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- Provide post-session resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.
- Complete Voice Room Active filter contract and lock host stage and audience UI contract.
- Harden TURN/STUN connectivity for corporate NATs.
- AI-generated Session Summary.
- Categorise active Voicerooms.
- HLS/DASH on-the-fly video transcoding.
- Fix WebRTC edge cases (Bluetooth headset interrupts).
- Fix inviteCoHost race conditions (Centrifugo events arriving out of order).
- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.

## 🔍 Discovery & Matchmaking
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery map and search features.
- Build Matchmaking & Discovery tools with GPS-based distance slider, dynamic Hobbies & Interests tags, and Serious Learner filter.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.
- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Audit and propose advanced partner discovery ranking signals.
- Converge discovery error actions on Spartan.

## 🧠 Learning & AI Tools
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Spaced Repetition (SRS) and LingQ Engine.
- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module.
- Implement advanced AI integrations: Context menu option for AI-generated grammar breakdowns, partial credit scoring for minor typos during SRS reviews, and Suggest Flashcards feature.
- Foster language habits with push notification reminders, daily check-in coin rewards, and progress tracking with unlockable badges.

## Discovery & Matchmaking

- Build Matchmaking & Discovery tools with explicit GPS-based distance slider, dynamic Hobbies & Interests tags, and standardise active Serious Learner filter.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.
- Converge discovery error actions on Spartan.

## 🧠 Learning, Vocabulary & AI Tools

- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module.

- Integrate Correction Modal with SRS Flashcards and harden language correction visual diffs.
- Implement advanced AI integrations: Context menu option for AI-generated grammar breakdowns, partial credit scoring for minor typos during SRS reviews, and Suggest Flashcards feature.
- Make diagnostic quiz completion durable and dynamic.
- Foster language habits with push notification reminders, daily login rewards, and progress tracking with unlockable badges.
- Complete coin-funded language challenges.
- Integrate unified learner knowledge model for personalization.
- Route translation and transliteration providers.
- Complete daily learning tip design sync.

## 👑 Monetisation & VIP

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.

- **GPS-Based Discovery:** Make Nearby use explicit GPS location with a distance slider.
- **Matchmaking Tools:** Dynamic Hobbies & Interests tags and standardise active Serious Learner filtering.
- **Premium Discovery:** Pro tier offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.

## 🧠 Learning, Vocabulary & AI Tools

- **Flashcard & Spaced Repetition (SRS):** Flashcard Deck UI, interactive Flashcard Review UI with flip animations, partial credit scoring for minor typos during SRS reviews, and Suggest Flashcards feature.
- **Language Practice:** Verb conjugation trainer, IPA alphabet module, 50/50 language exchange timers, and dynamic diagnostic quiz completion.
- **AI Integration:** Architectural enhancements for Language Learning Synergy (integrate Pronunciation/AI with Flashcards and Reading Engine), Context menu option for AI-generated grammar breakdowns, Pronunciation Scoring service, and strict LLM prompt injection protection.
- **Motivation & Engagement:** Push notification reminders, coin-funded language challenges, daily check-in coin rewards, atomic login rewards, and progress tracking with unlockable badges.

## 👑 Monetisation, VIP & Virtual Economy

- **In-App Economy:** Sticker Store UI, animated sticker packs, Virtual Gift animations, and premium one-off AI services (with daily usage limits).
- **Subscription Services:** Implement subscription/purchasing mechanisms, Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction.
- **VIP Perks:** Location spoofing, incognito profile views, and unlimited AI.


## 🛡️ Trust & Safety (Moderation)

- **Moderation Tools:** Complete production Block Management and lock ban/warn moderation endpoints.
- **Content Safety:** Enforce typed user-content sanitisation boundaries (exempting non-user-authored fields) and add ASN hosting risk controls.

## ✨ Feature Enhancements, Platform & UI Architecture

## ⚙️ Platform Stability, Architecture & Automation

- **Core Infrastructure & UX:** Align UI contracts with Spartan UI and Relay themes (e.g., sidebars, developer dashboards), define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- **Technical Improvements:** Stabilize Visual Diff Component (Myers diff, optimized segmenter), Configure Angular Universal (SSR), Audit RxJS subscriptions and migrate to Angular Signals where possible.
- **Job Processing & Sync:** Implement TimelineWorker backend job for fan-out processing, fix IDOR/secrets validation for LiveKit and Stripe, and fail closed on missing Supabase sessions.
- **Diagnostics & Testing:** Implement missing E2E test flows (Auth, Chat, Moments), custom Angular ErrorHandler logging to backend, Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and agent workflows for security vulnerabilities.
- **Developer Experience:** Reduce automation churn and Codex reasoning burn without lowering quality.
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
- Build Matchmaking & Discovery tools with GPS-based distance slider, dynamic Hobbies & Interests tags, and Serious Learner filter.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.

## Learning & AI Tools

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
- Architectural Enhancements for Language Learning Synergy (integrate Pronunciation/AI with Flashcards and Reading Engine).
- unlock premium one-off AI services.
- 50/50 language exchange timers.
- daily AI usage rate limiting.
- strict LLM prompt injection protection.
- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, verb conjugation trainer, and IPA alphabet module.
- Implement advanced AI integrations: Context menu option for AI-generated grammar breakdowns, partial credit scoring for minor typos during SRS reviews, and Suggest Flashcards feature.
- Foster language habits with push notification reminders, daily check-in coin rewards, and progress tracking with unlockable badges.

- 50/50 language exchange timers and verb conjugation trainer.
- partial credit scoring.
- daily AI usage rate limiting and strict LLM prompt injection protection.
- Build robust learning tools: Flashcard Deck UI, interactive Flashcard Review UI with flip animations, and IPA alphabet module.
- Foster language habits with push notification reminders and progress tracking with unlockable badges (Achievements service in NestJS).


## Monetisation & Premium Features

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.

## Trust, Safety & Moderation

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

## 👑 Monetisation & VIP
- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Provide enhanced user toggles: Hide Online Status and Hide VIP Status.

## ✨ Feature Enhancements
- Integrate diagnostic tools: Dynamic diagnostic quiz component for new sign-ups and custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.
- Optimize performance for data-heavy views by implementing virtual scrolling (Angular CDK) in Chat and Reading screens.

## 👑 Monetisation & Premium Features

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Sticker Store UI, and animated sticker packs.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.
- unlock premium one-off AI services.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.


## Platform, Architecture & Enhancements


- Integrate diagnostic tools: Dynamic diagnostic quiz component for new sign-ups and custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.
- Optimize performance for data-heavy views by implementing virtual scrolling (Angular CDK) in Chat and Reading screens (Ref: PR #8448).
- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- Fail closed on missing Supabase sessions and fix IDOR / secrets validation for LiveKit and Stripe.
- Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts.
- Reduce automation churn and Codex reasoning burn without lowering quality.
- Implement virtual scrolling for data-heavy chat and reading views to prevent DOM bloat and UI lag.

- Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat and reading views to prevent DOM bloat and UI lag.

- Ensure Performance and Scalability for Data-Heavy Views
  - Implement Angular CDK Virtual Scrolling for Chat and Reading views to prevent DOM bloat, memory leaks, and UI lag when handling extensive chat histories or large reading texts

- Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat and reading views to prevent DOM bloat and UI lag.
- Implement missing E2E test flows for Authentication, Chat Messaging, and Moment Creation.
- Exempt non-user-authored body fields from sanitization.
- Configure Angular Universal (SSR).
- Audit RxJS subscriptions and migrate to Angular Signals where possible.
- Agent workflow to check for security issues and vulnerabilities.
- Automated push notification reminders.
- Achievements service in NestJS.
- Integrate diagnostic tools: Dynamic diagnostic quiz component for new sign-ups and custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) across all systems.

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
- Complete comprehensive i18n localization across all frontend modules (replace hardcoded strings and ensure coverage in I18nService.baseDictionary with British English defaults and the applicable en-GB dictionary).

## Acceptance criteria and provenance

This file is a summary. The complete acceptance criteria and source references, including PR #8448, remain in `wiki/Issues_Backlog.md`; that document is authoritative when this summary omits detail. Preserve dynamic-height handling, pagination, DOM bounds and viewport position when evaluating virtual scrolling.


  - Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
  - Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
  - Implement virtualised rendering or windowing in the reading components for extensive texts.
  - Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
  - Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
  - Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

## ⚙️ Platform, UI Architecture & Automation
- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- Fail closed on missing Supabase sessions and fix IDOR / secrets validation for LiveKit and Stripe.
- Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts.
- Reduce automation churn and Codex reasoning burn without lowering quality.




