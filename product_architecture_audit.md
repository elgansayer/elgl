# Product Information Architecture & Capability Mapping

Status: source inventory and proposed information architecture. The proposed grouping is not the current route configuration or an approved migration. Preserve legacy deep links and their query parameters. Runtime route files under `frontend/src/app/routes` remain authoritative; root currently redirects to `/ai-conversation`.

## Overview
This report outlines the user-facing routes, capabilities, overlaps, redundancies, and a consolidated architecture for the platform.

## 1. Current Route Mapping
### Social Routes (`social.routes.ts`)
- `/discovery`: Discovery component
- `/moments`: Moments feed
- `/profile`: User profile
- `/profile/:userId`: User detail
- `/profile/:userId/followers` & `/profile/:userId/following`: Follow lists
- `/profile/visitors`: Profile visitors (redirect from `/visitors`)
- `/favourites`: Favourites bookmarking
- `/leaderboard`: Leaderboard
- `/hobby-tags`: Hobby tags
- `/stats`: User stats
- `/milestones`: User milestones
- `/notifications`: Notifications inbox
- `/events` & `/events/calendar`: Events feed and calendar
- `/business-profile`: Business profile
- Redundancies/Redirects: `/language-parties` -> `/community/language-parties`, `/language-islands` -> `/community/language-islands`

### Learning Routes (`learning.routes.ts`)
- `/vocabulary`: Vocabulary dashboard
- `/decks`: Flashcard decks
- `/review`: Flashcard review
- `/suggest-flashcards` & `/suggest-flashcards/:message`: Flashcard suggestions
- `/diagnostic-quiz` & `/proficiency`: Language level assessment
- `/lessons`: Lessons component
- `/quests`: Quests component
- `/read`: LingQ reading engine
- `/resource-library`: Resource library
- `/pronunciation-feedback`: Pronunciation scoring
- `/study-streak` & `/study-buddy`: Study gamification and matching
- `/ai-conversation`: AI conversation module (default app route)

### Chat & Community Routes (`chat.routes.ts` & `app.routes.ts`)
- `/chat` & `/chat/:id`: Chat list and room
- `/community`: Communities component (`app.routes.ts`)
- `/groups`: Groups discovery
- `/join` & `/join/:code`: Join group flow
- Redundancies/Redirects: `/communities` -> `/community`, `/groups/create` -> `/community/groups/create`, `/chat-settings` -> `/settings/chat`

### Media Routes (`media.routes.ts`)
- `/audio-rooms`: Audio drop-in rooms
- `/classrooms`: Video classrooms marketplace
- `/video-call` & `/active-call`: Video calling components
- `/call-logs`: Call history
- `/voiceroom-notes/:roomId` & `/preview/room/:id`: Voice room tools
- `/host-dashboard`: Host broadcasting dashboard

### Commerce Routes (`commerce.routes.ts`)
- `/subscription`: Subscription plans (redirect from `/vip`)
- `/shop`, `/sticker-store`, `/cart`: Virtual goods storefront
- `/coin-economy`: Virtual coin dashboard
- `/escrow` & `/escrow/:id`: Escrow payments

### Settings Routes (`settings.routes.ts`)
- `/settings`: Main settings hub
- Nested settings: `/settings/account`, `/settings/notification`, `/settings/message-filters`, `/settings/appearance`, `/settings/language`, `/settings/privacy`, `/settings/blocks`, `/settings/backup-restore`, `/settings/linked-accounts`, `/settings/data-storage`, `/settings/device-transfer`, `/settings/gdpr`, `/settings/account/deletion`, `/settings/version`
- Many top-level redundancies redirecting to settings: `/language`, `/blocks`, `/data-storage`, `/device-transfer`, `/gdpr`, `/account/deletion`, `/version`.

## 2. Identified Redundancies, Overlaps, and Contradictions
- **Community vs Groups vs Communities:** There is a top-level `/community` route handling 'Communities' but also a `/groups` route for 'Groups Discovery'. It is unclear how a 'Group' differs from a 'Community'. The redirect `/groups/create` -> `/community/groups/create` suggests they overlap conceptually.
- **Events vs Language Parties / Islands:** Social routes contain `/events`, but also redirect `/language-parties` and `/language-islands` into `/community/...`. This splinters 'happenings' across Social and Community.
- **Learning Progress:** `/diagnostic-quiz` vs `/proficiency`. Are these two different flows for the same goal (measuring language level)?
- **Vocabulary Management:** `/vocabulary` vs `/decks` vs `/review`. There's potential to consolidate these into a single Vocabulary Hub rather than separate top-level routes.
- **Settings Splat:** Too many legacy top-level routes (e.g., `/blocks`, `/language`, `/gdpr`) exist merely to redirect to `/settings/...`. While not harmful, it shows legacy architectural sprawl.
- **Profile & Stats:** `/profile`, `/stats`, `/milestones` are all separate top-level social routes when they conceptually belong to a unified user profile view.

## 3. Consolidated Product Information Architecture
We propose collapsing the scattered routes into 6 distinct Core Pillars.

### Pillar 1: Social & Discovery (The Hub)
**Purpose:** Finding people, consuming cultural content, and interacting passively.
- `/moments` (Feed)
- `/discovery` (Matchmaking / Find Partners)
- `/leaderboard`

### Pillar 2: Chat & Communication
**Purpose:** Direct 1-on-1 and Group textual communication.
- `/chat` (Inbox & Active Conversations)
- `/chat/groups` (Consolidating Communities and Groups into a single 'Group Chats' interface)

### Pillar 3: Live Media & Events
**Purpose:** Real-time audio/video participation and scheduled gatherings.
- `/live` (Consolidated entry point)
  - `/live/audio` (Audio Rooms)
  - `/live/video` (Classrooms / Streams)
  - `/live/events` (Consolidating Events, Language Parties, and Calendar)

### Pillar 4: Learning & AI (The Classroom)
**Purpose:** Structured study, AI assistance, and vocabulary building.
- `/learn` (Dashboard)
  - `/learn/lessons` (Structured Quests & Lessons)
  - `/learn/ai-chat` (AI Conversation)
  - `/learn/read` (LingQ Engine)
  - `/learn/vocabulary` (Consolidating Decks, Review, and Dashboard)
  - `/learn/assessment` (Consolidating Diagnostic Quiz, Proficiency, and Pronunciation)

### Pillar 5: User Identity (Me)
**Purpose:** Managing personal presence, achievements, and statistics.
- `/profile/me`
  - `/profile/me/stats` (Stats & Milestones)
  - `/profile/me/visitors`
  - `/profile/me/favourites`

### Pillar 6: Commerce & Settings
**Purpose:** Account configuration and monetisation.
- `/shop` (Coins, Stickers, Escrow)
- `/subscription` (VIP Status)
- `/settings` (All configurations cleanly scoped under this path)
