# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## 💬 1-on-1 Chat & Messaging

- Complete emoji message reactions, disappearing messages, per-user archive and hidden chat folders, and per-user priority inbox pins.
- Add swipe-to-reply gesture and hold-to-record direct voice notes with playback speed controls and audio compression.
- Complete group chat features for 2-19 members based on specific interests, including real-time text correction tools and group participant drawer.
- Add message privacy filters based on age, gender, and native language.
- Enhance message interaction with edit capability, typing indicators, and read receipts.
- Implement search functionality (client-side and server-side) within individual chats or across all conversations.
- Provide AI tools in chat: conversation starter suggestions, role-play scenarios, and "Simplify this text" options.

## 👥 Communities & Groups

- Complete Responsive Communities Experience with mobile drawer, unread badges, hover effects, community creation flow and error handling.
- Dedicated Groups & Scheduled Events System.

## 📰 Moments & Social Feed

- Complete production liked-by modal.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Enhance discovery feeds with advanced filters (Serious Learner mode, Interests, Mute Word) and algorithmic recommendations (Partner of the Week).
- Persist muted word filters across devices.
- Build interactive multi-media posts: swipeable full-screen lightboxes for images and Audio Intros feed.
- Implement AI Pronunciation Scoring service for spoken audio in posts and provide haptic feedback for flashcard grading.
- Complete safe quick actions for follow lists.

## 👤 User Profiles & Settings

- Build comprehensive Profile Settings and UI: Cover Photo uploader, Language Settings, Appearance Settings, Dynamic Font Size slider, and Privacy Settings hub.
- Support detailed profile metadata: free-text learning goals, proficiency levels (`a1` to `c2`), 30-second Audio Introduction, and translated bio.
- Implement advanced user controls: Personal Data Collection GDPR hub, Linked Accounts page, Account Deletion workflow, Block Management page, and RSVP functionality for events.
- Deploy monetisation features: VIP tier (location spoofing, incognito profile views, unlimited AI), Developer Tier API key management, and Virtual Gift animations.
- Add privacy-safe profile visit tracking and Who Viewed Me logs.
- Add online and VIP status visibility controls.
- Align cover photo cropper with Relay theme.

## 🎙️ Live Audio Rooms & Video Events

- Complete centralized events discovery and centralized discovery feed.
- Complete Create Event modal and safe Attending and Interested RSVPs.
- Implement Private Parties (VIP/Pro tier) and split-screen video layout for Invite Co-Host features.
- Develop Host Moderation controls (Mute speaker, kick off stage, Raise Hand button, Soundboard for pre-recorded audio clips).
- Enhance audience engagement with full-screen SVG gift animations, Quick Polls, animated audio equalizer visualizer, and live chat comment overlay.
- Provide post-session resources: AI-generated Session Summaries and HLS/DASH on-the-fly video transcoding for class replays.

## 🔍 Discovery & Matchmaking

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

## 🛡️ Trust & Safety (Moderation)

- Complete production Block Management and lock ban and warn moderation endpoints.
- Enforce typed user-content sanitisation boundaries.
- Add ASN hosting risk controls.

## ✨ Feature Enhancements, Platform & UI Architecture

- Integrate diagnostic tools: Dynamic diagnostic quiz component for new sign-ups and custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Optimize app infrastructure and UX: Web Vitals audits (e.g., `loading=lazy`), offline support via IndexedDB, client-side image compression, and WebSocket connection rate limiting.
- Develop universal connectivity features: In-App Sharing, External Deep Linking Engine, and End-to-end encrypted voice calls.
- Optimize performance for data-heavy views by implementing virtual scrolling (Angular CDK) in Chat and Reading screens (Ref: PR #8448).
- Align UI contracts with Spartan UI and Relay themes (desktop sidebars, confirm dialogs, developer dashboards).
- Define 400 percent zoom reflow standard, enforce touch target sizing, and lock screen-reader naming contracts.
