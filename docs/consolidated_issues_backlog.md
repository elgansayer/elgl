# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

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
