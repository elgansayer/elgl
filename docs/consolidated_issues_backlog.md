# 📋 Consolidated Product Backlog

_Organized by complete user outcomes rather than individual technical chores._

## 1-on-1 Chat & Messaging

- Complete emoji message reactions, disappearing messages, per-user archive and hidden chat folders, and per-user priority inbox pins.
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
- Harden Centrifugo connection token endpoint and lock connection-token contract.

## Moments & Social Feed

- Complete production liked-by modal.
- Persist muted word filters across devices.
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
- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.

## User Profiles, Settings & Privacy

- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls.
- Add free-text learning goals and complete Translate Bio accessibility contract.
- Align cover photo cropper with Relay theme.
- Complete safe Data & Storage controls and complete private data archive and deletion lifecycle (GDPR).
- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: Learning Goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.
- Implement advanced user controls: Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow, Block Management page, and RSVP functionality for events.

## Live Audio Rooms & Video Events

- Complete centralized events discovery and centralized discovery feed.
- Complete Create Event modal and safe Attending and Interested RSVPs.
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

## Discovery & Matchmaking

- Make Nearby use explicit GPS location.
- Complete persisted Serious Learner mode and standardise active Serious Learner filtering.
- Converge discovery error actions on Spartan.
- Build Matchmaking & Discovery tools with GPS-based distance slider, dynamic Hobbies & Interests tags, and Serious Learner filter.
- Build a Pro subscription tier (Tandem Pro clone) offering unlimited translations, advanced visitor logs, nearby members visibility, and ad-free browsing.

## Learning & AI Tools

- Integrate Correction Modal with SRS Flashcards and harden language correction visual diffs.
- Make diagnostic quiz completion durable and dynamic.
- Complete coin-funded language challenges.
- Integrate unified learner knowledge model for personalization.
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

## Monetisation & Premium Features

- Implement subscription and purchasing mechanisms: Restore Purchases workflow, server-side App Store receipt validation, and coin balance auto-deduction for gifts.
- Build in-app economy features: Language Challenge system with coin-based entry fees, Sticker Store UI, and animated sticker packs.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.

## Trust, Safety & Moderation

- Complete production Block Management and lock ban and warn moderation endpoints.
- Enforce typed user-content sanitisation boundaries.
- Add ASN hosting risk controls.

## Platform, Architecture & Enhancements

- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- Fail closed on missing Supabase sessions and fix IDOR / secrets validation for LiveKit and Stripe.
- Harden authenticated OpenGraph scraping and Prometheus/Grafana compose contracts.
- Reduce automation churn and Codex reasoning burn without lowering quality.
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
