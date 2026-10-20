# Product Information Architecture & Capability Mapping

Status: source inventory and proposed information architecture. The proposed grouping is not the current route configuration or an approved migration. Preserve legacy deep links and their query parameters. Runtime route files under `frontend/src/app/routes` and `frontend/src/app/app.routes.ts` remain authoritative; root currently redirects to `/ai-conversation`.

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
- Redundancies/Redirects: `/language-parties` -> `/community/language-parties`, `/language-islands` -> `/community/language-islands`, `/notification-preferences` -> `/settings/notification`, `/visitors` -> `/profile/visitors`

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
- Redundancies/Redirects: `/communities` -> `/community`, `/groups/create` -> `/community/groups/create`, `/chat-settings` -> `/settings/chat`, `/message-filters` -> `/settings/message-filters`, `/blocks` -> `/settings/blocks`

### Media Routes (`media.routes.ts`)
- `/audio-rooms`: Audio drop-in rooms
- `/classrooms`: Video classrooms marketplace
- `/video-call` & `/active-call`: Video calling components
- `/call-logs`: Call history
- `/voiceroom-notes/:roomId` & `/preview/room/:id`: Voice room tools
- `/host-dashboard`: Host broadcasting dashboard

### Commerce Routes (`commerce.routes.ts`)
- `/subscription`: Subscription plans
- `/subscription/success` & `/subscription/cancel`: Subscription feedback
- `/settings/subscription`: User subscription settings
- `/shop`, `/sticker-store`, `/cart`: Virtual goods storefront
- `/coins/success` & `/coins/cancel`: Coins purchase feedback
- `/coin-economy`: Virtual coin dashboard
- `/escrow` & `/escrow/:id`: Escrow payments
- Redundancies/Redirects: `/vip` -> `/subscription`, `/my-subscription` -> `/settings/subscription`

### Settings Routes (`settings.routes.ts`)
- `/settings`: Main settings hub
- Nested settings: `/settings/chat`, `/settings/account`, `/settings/notification`, `/settings/message-filters`, `/settings/appearance`, `/settings/language`, `/settings/privacy`, `/settings/blocks`, `/settings/backup-restore`, `/settings/linked-accounts`, `/settings/data-storage`, `/settings/device-transfer`, `/settings/gdpr`, `/settings/account/deletion`, `/settings/version`
- Redundancies/Redirects: `/language` -> `/settings/language`, `/blocks` -> `/settings/blocks`, `/data-storage` -> `/settings/data-storage`, `/device-transfer` -> `/settings/device-transfer`, `/gdpr` -> `/settings/gdpr`, `/account/deletion` -> `/settings/account/deletion`, `/version` -> `/settings/version`, `/settings/notification-customization` -> `/settings/notification`

### Admin Routes (`admin.routes.ts`)
- `/admin`: Admin portal
- `/admin/lessons`: Lesson management
- `/admin/moderation`: Moderation queue
- `/admin/blocks`: Block management
- `/admin/users`: Admin users
- `/developer`: Developer dashboard

### Auth & Onboarding Routes (`auth.routes.ts`)
- `/onboarding`: Onboarding wizard
- `/forgot-password`, `/reset-password`, `/change-password`: Password management
- `/lock`: App lock
- `/terms`, `/privacy`: Legal documents
- `/support`: Support centre
- Redundancies/Redirects: `/help` -> `/support`, `/help-about` -> `/support`

### Root & Base Routes (`app.routes.ts`)
- `/home`: Home
- `/community`: Communities component
- `/ai-conversation`: Default redirect route

### Auth & Legal Routes (`auth.routes.ts`)
- `/onboarding`: Onboarding wizard
- `/forgot-password`: Forgot password
- `/reset-password`: Reset password
- `/change-password`: Change password
- `/lock`: App Lock
- `/terms`: Terms of Service
- `/privacy`: Privacy Policy
- `/support`: Support Centre
- Redundancies/Redirects: `/help` -> `/support`, `/help-about` -> `/support`

### Admin & Core App Routes (`app.routes.ts`, `admin.routes.ts`)
- `/home`: Home component
- `/admin`: Admin Portal
- `/admin/lessons`: Lesson Management
- `/admin/moderation`: Moderation Queue
- `/admin/blocks`: Block Management
- `/admin/users`: Admin Users
- `/developer`: Developer Dashboard

## 2. Identified Redundancies, Overlaps, and Contradictions
- **Community vs Groups vs Communities:** There is a top-level `/community` route handling 'Communities' but also a `/groups` route for 'Groups Discovery'. It is unclear how a 'Group' differs from a 'Community'. The redirect `/groups/create` -> `/community/groups/create` suggests they overlap conceptually.
- **Events vs Language Parties / Islands:** Social routes contain `/events`, but also redirect `/language-parties` and `/language-islands` into `/community/...`. This splinters 'happenings' across Social and Community.
- **Learning Progress:** `/diagnostic-quiz` vs `/proficiency`. Are these two different flows for the same goal (measuring language level)?
- **Vocabulary Management:** `/vocabulary` vs `/decks` vs `/review` vs `/suggest-flashcards`. There's potential to consolidate these into a single Vocabulary Hub rather than separate top-level routes.
- **Settings Splat:** Too many legacy top-level routes (e.g., `/blocks`, `/language`, `/gdpr`, `/data-storage`, `/device-transfer`) exist merely to redirect to `/settings/...`. While not harmful, it shows legacy architectural sprawl. Furthermore, there are scattered settings routes like `/chat-settings` -> `/settings/chat`, `/message-filters` -> `/settings/message-filters`.
- **Profile & Stats:** `/profile`, `/stats`, `/milestones` are all separate top-level social routes when they conceptually belong to a unified user profile view.
- **Home vs Default Route:** Root `/` redirects to `/ai-conversation`, but there is a `/home` route. It's unclear what the primary landing experience should be.
- **Support Redundancies:** `/help` and `/help-about` both redirect to `/support`.

## 3. Consolidated Product Information Architecture
We propose collapsing the scattered routes into distinct Core Pillars.
- **Support & Help:** `/help`, `/help-about` all redirect to `/support`, showing fragmented entry points.
- **Subscriptions & VIP:** `/vip` and `/my-subscription` both redirect to subscription related routes.

## 3. Consolidated Product Information Architecture
We propose collapsing the scattered routes into distinct Core Pillars to ensure every major capability has a clear purpose, entry point, and relationship to the rest of the app.

### Pillar 1: Social & Discovery (The Hub)
**Purpose:** Finding people, consuming cultural content, and interacting passively.
- `/moments` (Feed)
- `/discovery` (Matchmaking / Find Partners)
- `/leaderboard`
- `/hobby-tags`

### Pillar 2: Chat & Community
**Purpose:** Direct 1-on-1 and Group textual communication, and larger community interactions.
- `/chat` (Inbox & Active Conversations)
- `/community` (Consolidating Communities and Groups into a unified community hub)
  - `/community/groups` (Group discovery and creation)

### Pillar 3: Live Media & Events
**Purpose:** Real-time audio/video participation and scheduled gatherings.
- `/live` (Consolidated entry point)
  - `/live/audio` (Audio Rooms)
  - `/live/video` (Classrooms / Streams)
  - `/live/events` (Consolidating Events, Language Parties, and Calendar)

### Pillar 4: Learning & AI (The Classroom)
**Purpose:** Structured study, AI assistance, and vocabulary building.
- `/learn` (Dashboard, potentially consolidating `/home`)
  - `/learn/lessons` (Structured Quests & Lessons)
- `/learn` (Dashboard, consolidating `/lessons` and `/quests`)
  - `/learn/ai-chat` (AI Conversation)
  - `/learn/read` (LingQ Engine)
  - `/learn/vocabulary` (Consolidating Decks, Review, Flashcards, and Dashboard)
  - `/learn/assessment` (Consolidating Diagnostic Quiz, Proficiency, and Pronunciation)
  - `/learn/resources` (Resource Library)
  - `/learn/study-buddy` (Study streak and buddy matchmaking)

### Pillar 5: User Identity (Me)
**Purpose:** Managing personal presence, achievements, and statistics.
- `/profile/me` (Unified profile)
  - `/profile/me/stats` (Stats & Milestones)
  - `/profile/me/visitors`
  - `/profile/me/favourites`
  - `/profile/me/business` (Business profile)

### Pillar 6: Commerce, Subscriptions & Settings
**Purpose:** Account configuration, monetization, and virtual economy.
- `/shop` (Coins, Stickers, Escrow)
- `/subscription` (VIP Status)
- `/settings` (All configurations cleanly scoped under this path)

### Pillar 7: Auth, Legal & Support
**Purpose:** Authentication flows, legal documents, and user assistance.
- `/auth` (Consolidating Onboarding, Password Management, and App Lock)
- `/legal` (Consolidating Terms and Privacy)
- `/support` (Help and Support Centre)

### Pillar 8: Admin & Platform Management
**Purpose:** System administration, moderation, and developer tools.
- `/admin` (Portal for Users, Moderation, Blocks, and Lessons)
- `/developer` (Developer Dashboard)
- `/subscription` (VIP Status and Management)
- `/settings` (All configurations cleanly scoped under this path: Account, Privacy, Notifications, Chat/Filters, Language, App/Device, GDPR)

### Pillar 7: Admin & Support (Operations)
**Purpose:** System administration, legal docs, user support, and moderation.
- `/admin` (Admin dashboard and moderation tools)
- `/developer` (Developer tools)
- `/support` (Help center, Legal terms, and Privacy policies)
