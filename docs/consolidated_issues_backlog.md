# 📋 Consolidated Product Backlog

_Organized by complete user outcomes rather than individual technical chores._

## 💬 1-on-1 Chat & Messaging

- **Enhanced Message Interactions:** Complete emoji message reactions, disappearing messages (24h/7d/90d), edit sent messages, swipe-to-reply gestures, forwarding messages, typing indicators, and read receipts.
- **Voice & Media:** Implement hold-to-record voice notes with playback speed controls, settings toggle to auto-play sequential voice notes, instant video messages, and audio compression.
- **Organization & Search:** Add per-user archive, hidden chat folders, per-user priority inbox pins, and comprehensive search functionality within chats and across all conversations.
- **Privacy & Safety:** Enable direct messaging filters based on age, gender, and native language, plus automated PII scrubbing.
- **AI Chat Tools:** Provide conversation starter suggestions, role-play scenarios, and "Simplify this text" options in chat.
- **Performance & Stability:** Implement virtual scrolling for data-heavy chat views, and WebSocket connection rate limiting.

## 👥 Communities & Group Chat

- **Group Collaboration:** Develop Group Chats feature for 2-19 partners based on specific interests, including real-time text correction tools for members, and a group participant drawer.
- **Responsive Communities Experience:** Deliver a responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) with mobile drawer view, active state styling, micro-interactions, unread badges, and extracted community creation components with robust error handling.
- **Events Integration:** Dedicated Groups & Scheduled Events System.

## 📰 Moments & Social Feed

- **Interactive Multimedia Posts:** Build swipeable full-screen lightboxes for images and an Audio Intros feed, including Chart.js integration for visual data representation.
- **Feed Engagement & Filtering:** Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word, "Has Audio Intro"), Recommended for You carousel, Partner of the Week, and robust algorithm-based content recommendations.
- **Social Interactions:** Build unified Notifications Area (Inbox), complete production liked-by modal, safe quick actions for follow lists, and Correction Quality rating system.

## 👤 User Profiles & Settings

- **Comprehensive Profile Display:** Add free-text learning goals, proficiency levels, 30-second Audio Introduction, and translated bio with accessibility features.
- **Profile Customisation & Settings:** Cover Photo uploader aligned with Relay theme, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- **Privacy & Control:** Privacy-safe profile visit tracking ("Who Viewed Me" logs), online and VIP status visibility controls, "Who can see my profile" toggle, Personal Data Collection GDPR hub, Linked Accounts page, Block Management page, and complete private data archive/deletion lifecycle.

## 🎙️ Live Audio Rooms & Video Events

- **Centralized Event Discovery:** Build centralized events discovery and discovery feed, along with a Create Event modal and safe Attending/Interested RSVPs.
- **Host & Audience Controls:** Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand, Soundboard), lock host stage and audience UI contract, and categorize active Voicerooms.
- **Interactive Enhancements:** Quick Polls, full-screen SVG gift animations, animated audio equalizer, and live chat comment overlay.
- **Video & Room Types:** Private Parties (VIP/Pro tier), split-screen video layout for Invite Co-Host features.
- **Post-Session Value:** AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.

## 🔍 Discovery & Matchmaking

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

## ⚙️ Platform Stability, Architecture & Automation

- **Core Infrastructure & UX:** Align UI contracts with Spartan UI and Relay themes (e.g., sidebars, developer dashboards), define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
- **Technical Improvements:** Stabilize Visual Diff Component (Myers diff, optimized segmenter), Configure Angular Universal (SSR), Audit RxJS subscriptions and migrate to Angular Signals where possible.
- **Job Processing & Sync:** Implement TimelineWorker backend job for fan-out processing, fix IDOR/secrets validation for LiveKit and Stripe, and fail closed on missing Supabase sessions.
- **Diagnostics & Testing:** Implement missing E2E test flows (Auth, Chat, Moments), custom Angular ErrorHandler logging to backend, Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and agent workflows for security vulnerabilities.
- **Developer Experience:** Reduce automation churn and Codex reasoning burn without lowering quality.
