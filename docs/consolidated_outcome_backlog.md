# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## 💬 1-on-1 Chat & Messaging
- Stabilize Chat Foundation (Security, caching, rate limiting, error handling, Datadog/Prometheus).
- Enhance Chat Interactions: Disappearing messages, swipe-to-reply, hold-to-record voice notes, auto-play sequential voice notes, emoji reactions, read receipts, typing indicators, edit/forward messages, priority inbox pins, and hidden/archive folders.
- Search and Filtering: Client-side and server-side message search, and privacy/demographic filters.
- AI Chat Integration: Conversation starters, role-play scenarios, and "Simplify this text" features.

## 👥 Communities & Groups
- Responsive Communities Layout: Implement three-pane responsive layout with mobile drawer, active state styling, unread badges, and hover effects.
- Group Chat Expansion: Support 2-19 members, dedicated groups, scheduled events, and real-time text correction tools.
- Infrastructure: Extract community list/creation into separate components for scalability, add error handling (try/catch), and harden Centrifugo token endpoint/connections.

## 📰 Moments & Social Feed
- Stabilize Feed Foundation: Security, caching, rate limiting, error handling, and monitoring.
- Unified Notifications: Centralized inbox for system alerts, likes, comments, and followers.
- Content Discovery & Actions: Advanced filters (Serious Learner, Interests, Mute Word persistence), AI recommendations, swipeable lightboxes, Audio Intros feed, and safe quick actions for follow lists.
- Quality & Infrastructure: AI Pronunciation Scoring with haptic feedback, Chart.js integrations, and harden TimelineWorker fan-out pagination.

## 👤 User Profiles & Settings
- Stabilize Profile Foundation: Security, caching, rate limiting, and monitoring.
- Comprehensive Profile Customization: Cover photo cropper aligned with Relay theme, Language/Appearance settings, Dynamic Font Size, Learning Goals, and Translate Bio accessibility.
- Privacy & Safety: Personal Data Collection GDPR hub, linked accounts, account deletion, profile visit tracking (Who Viewed Me), online/VIP status toggles, and robust Block Management.
- Monetisation (VIP/Pro): Location spoofing, incognito profile views, unlimited AI, server-side App Store receipt validation, virtual gift animations, and Developer Tier API management.

## 🎙️ Live Audio Rooms & Video Events
- Event Discovery & Management: Centralized events discovery, Create Event modal, and safe RSVP actions.
- Room Interactions: Private Parties (VIP/Pro), split-screen video co-hosts, Host Moderation controls (Mute, kick, Raise Hand, Soundboard), quick polls, comment overlays, and animated audio visualizers.
- Post-Session Resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding.
- Infrastructure: Fix WebRTC edge cases, fix inviteCoHost race conditions, and harden TURN/STUN connectivity.

## 🔍 Discovery & Matchmaking
- Location & Filtering: GPS-based distance slider, dynamic tags, and persisted Serious Learner filtering.
- Advanced Matchmaking: Audit/propose advanced partner discovery ranking signals.
- Infrastructure: Converge discovery error actions on Spartan.

## 🧠 Learning, Vocabulary & AI Tools
- Stabilize Learning Engine: Security, caching, rate limiting, and monitoring for Spaced Repetition (SRS) and LingQ Engine.
- Robust Learning Tools: Flashcard Deck UI, interactive reviews with flip animations, verb conjugation trainer, IPA alphabet module, and 50/50 language exchange timers.
- AI & Corrections: Context menu grammar breakdowns, partial credit scoring for typos, AI suggest flashcards, unify learner knowledge model, and stabilize Visual Diff Component.
- Engagement: Coin-funded language challenges, push notification reminders, daily check-in rewards, and dynamic diagnostic quiz for sign-ups.

## ⚙️ Platform, UI Architecture & Automation
- UI & Theming: Align UI contracts with Spartan UI and Relay themes, enforce 400% zoom reflow, touch target sizing, and screen-reader naming.
- Performance: Implement Angular CDK Virtual Scrolling for data-heavy chat and reading views.
- Security & Infrastructure: Exempt non-user-authored fields from sanitization, fail closed on missing Supabase sessions, fix LiveKit/Stripe IDOR, harden OpenGraph scraping, and migrate RxJS to Angular Signals.
- Automation: Implement Missing E2E tests (Auth, Chat, Moments), configure Angular Universal (SSR), reduce Codex reasoning burn, and implement security/vulnerability agent workflows.
