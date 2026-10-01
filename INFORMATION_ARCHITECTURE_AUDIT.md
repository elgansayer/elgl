# Product Information Architecture & Route Mapping

## Executive Summary
This document maps every user-facing route and major capability in the platform. It identifies overlapping, duplicate, redundant, or contradictory features and navigation paths, and proposes a consolidated product information architecture (IA) where every major capability has a clear purpose, entry point, and relationship to the rest of the application.

## 1. Route Mapping & Current Capabilities

The application's route structure is currently fragmented across multiple files with various alias redirects and potential overlaps.

### 1.1 Core Navigation (App Shell / Root)
* `/home` - Home landing experience
* `/community` - Communities landing
* `/ai-conversation` - Default root redirect (`/`)

### 1.2 Authentication & Legal (auth.routes.ts)
* `/onboarding` - User onboarding
* `/forgot-password`, `/reset-password`, `/change-password` - Credential management
* `/lock` - App lock/security
* `/terms`, `/privacy`, `/help`, `/support`, `/help-about` - Legal & Help

### 1.3 Social & Discovery (social.routes.ts)
* `/discovery` - Partner discovery
* `/moments` - Social feed
* `/profile`, `/profile/:userId` - User profiles
* `/profile/:userId/followers`, `/profile/:userId/following` - Social connections
* `/visitors` -> `/profile/visitors` - Profile visitors
* `/favourites` - Saved items
* `/leaderboard` - Gamification
* `/hobby-tags` - Profile interests
* `/stats` - My statistics
* `/milestones` - User milestones
* `/notifications` - Inbox
* `/notification-preferences` -> `/settings/notification` - Redundant routing
* `/events`, `/events/calendar` - Event management
* `/language-parties` -> `/community/language-parties` - Community alias
* `/language-islands` -> `/community/language-islands` - Community alias
* `/business-profile` - Business user profile

### 1.4 Chat & Groups (chat.routes.ts)
* `/chat` - Chat list
* `/chat/:id` - Direct chat room
* `/chat-settings` -> `/settings/chat` - Redundant routing
* `/groups` - Groups discovery
* `/groups/create` -> `/community/groups/create` - Redundant routing
* `/communities` -> `/community` - Redundant routing
* `/join`, `/join/:code` - Join group
* `/message-filters` -> `/settings/message-filters` - Redundant routing
* `/blocks` -> `/settings/blocks` - Redundant routing (also exists in settings.routes.ts)

### 1.5 Media & Communication (media.routes.ts)
* `/audio-rooms` - LiveKit audio
* `/classrooms` - Video marketplace
* `/video-call`, `/active-call`, `/call-logs` - 1:1 Video/Calls
* `/voiceroom-notes/:roomId`, `/preview/room/:id`, `/host-dashboard` - Audio room utilities

### 1.6 Learning & Immersion (learning.routes.ts)
* `/vocabulary`, `/decks`, `/review`, `/suggest-flashcards` - Spaced Repetition System
* `/diagnostic-quiz`, `/proficiency` - Assessment
* `/lessons`, `/quests`, `/read`, `/resource-library` - Content consumption
* `/pronunciation-feedback` - AI tooling
* `/study-streak`, `/study-buddy` - Gamification and Matching
* `/ai-conversation` - AI Chatbot

### 1.7 Commerce & VIP (commerce.routes.ts)
* `/vip` -> `/subscription` - Alias
* `/subscription`, `/subscription/success`, `/subscription/cancel` - Subscription lifecycle
* `/my-subscription` -> `/settings/subscription` - Redundant routing
* `/coins/success`, `/coins/cancel`, `/coin-economy` - Virtual currency
* `/shop`, `/sticker-store`, `/cart` - E-commerce
* `/escrow`, `/escrow/:id` - Payment escrow

### 1.8 Settings & Administration (settings.routes.ts & admin.routes.ts)
* `/settings` - Root settings hub
* `/settings/account`, `/settings/notification`, `/settings/appearance`, `/settings/language`, `/settings/privacy`, `/settings/blocks` - Categorized settings
* Various aliases pointing to settings: `/language` -> `/settings/language`, `/data-storage` -> `/settings/data-storage`, `/device-transfer` -> `/settings/device-transfer`, `/gdpr` -> `/settings/gdpr`, `/account/deletion` -> `/settings/account/deletion`, `/version` -> `/settings/version`
* `/admin/*` - Staff portal
* `/developer` - Developer Dashboard

## 2. Identification of Overlaps and Redundancies

### 2.1 Route Aliasing Bloat
The application currently uses top-level paths that simply redirect to nested paths. While this might have been useful for legacy deep links, it bloats the routing table and confuses the mental model of where features live.
* **Settings Aliases:** `/language`, `/data-storage`, `/device-transfer`, `/gdpr`, `/version`, `/account/deletion` all clutter the root namespace instead of keeping the user within the `/settings/*` hierarchy.
* **Community Aliases:** `/communities`, `/groups/create`, `/language-parties`, `/language-islands` point to a `/community` prefix, indicating a need for a consolidated Community hub.
* **Commerce Aliases:** `/vip` to `/subscription`, `/my-subscription` to `/settings/subscription`.

### 2.2 Duplicated Feature Areas
* **Groups vs. Communities vs. Language Parties:** There is conceptual overlap between `/groups` (Chat), `/community` (Root), `/language-parties` (Social), and `/language-islands`. These should be unified under a single "Community Discovery" capability.
* **Learning vs. Social Gamification:** `/leaderboard` (Social), `/stats` (Social), `/milestones` (Social) overlap conceptually with `/study-streak` (Learning) and `/quests` (Learning). These represent the same user desire (tracking progress) but are split across two domains.
* **VIP vs. Subscription:** The product uses both "VIP" and "Subscription" terminology interchangeably (e.g. `/vip` redirects to `/subscription`). The brand needs a unified vocabulary.
* **Audio Rooms vs. Classrooms:** `/audio-rooms` and `/classrooms` both serve group media broadcasts but sit at the root level instead of within a unified "Live" or "Broadcast" hub.

### 2.3 Contradictory Navigation Paths
* `/chat-settings` redirects to `/settings/chat`. `/settings/message-filters` handles message filtering, but there's a separate `/message-filters` root alias. The boundary between "Chat specific settings" and "Global App Settings" is blurred.
* Profile settings and App settings: `/profile` allows editing user identity, but `/settings/account` also manages identity.
* The root route `/` redirects to `/ai-conversation` instead of `/home`, which is unusual for a social app where the feed (`/moments` or `/home`) is typically the default entry point.

## 3. Consolidated Information Architecture Proposal

Every major capability should have a clear, singular entry point. The following is a proposed consolidation of the IA to eliminate root-level bloat and logically group features.

### Tier 1: Main Tab Navigation (The Core App Shell)
These are the primary entry points accessible from a bottom navigation bar or sidebar.

1. **Home / Feed (`/home` -> consolidates `/moments`)**
   * *Purpose:* The primary social and engagement timeline.
   * *Capabilities:* Moments feed, quick post creation, live activity highlights.
2. **Chat & Connections (`/chat`)**
   * *Purpose:* Direct messaging and connection management.
   * *Capabilities:* 1:1 chat, Group chat list, AI Conversation bot entry point, Call logs.
3. **Discover (`/discover` -> consolidates `/discovery`, `/community`, `/audio-rooms`)**
   * *Purpose:* Finding new people, groups, and live events.
   * *Capabilities:* Partner search, Group/Community directory, Live Audio/Video rooms directory, Language parties.
4. **Learn (`/learn` -> consolidates `/lessons`, `/vocabulary`, `/read`)**
   * *Purpose:* Structured and unstructured language learning.
   * *Capabilities:* LingQ reading engine, Flashcards/SRS, Lessons, Quizzes, Pronunciation tool.
5. **Me (Profile & Progress) (`/profile`)**
   * *Purpose:* Identity, gamification, and settings.
   * *Capabilities:* User profile, Followers/Following, Stats, Streaks, Leaderboard, Settings entry point.

### Tier 2: Sub-Hierarchies (Logical Groupings)

**A. Settings Hub (`/settings/*`)**
*Remove all root-level aliases. Users must access these via `/settings` or deep links that resolve explicitly to the full path.*
* `/settings/account` (Account & Password)
* `/settings/privacy` (Blocks, Message Filters, GDPR, Incognito)
* `/settings/notifications`
* `/settings/preferences` (Appearance, Language)
* `/settings/data` (Storage, Backup, Transfer)

**B. Commerce & Economy (`/shop/*`)**
*Unify the virtual economy and subscription management.*
* `/shop/vip` (Subscription plans - standardise on 'VIP' brand)
* `/shop/coins` (Coin purchasing and economy)
* `/shop/stickers` (Sticker store)
* `/shop/cart` & `/shop/escrow`

**C. Learning Tools (`/learn/*`)**
* `/learn/vocabulary` (Decks, Review, Suggest)
* `/learn/read` (Interactive Reading Engine)
* `/learn/practice` (AI Conversation, Pronunciation Feedback)
* `/learn/assess` (Diagnostic Quiz, Proficiency)

**D. Live & Media (`/live/*`)**
* `/live/audio` (Drop-in audio rooms)
* `/live/video` (Classrooms / Video streams)
* `/live/host-dashboard` (Creator tools)

### 4. Required Action Items for Refactoring

1. **Deprecate Root Aliases:** Remove redirects like `/language`, `/gdpr`, `/version`, `/vip`, `/blocks`, `/chat-settings` from the route configuration to enforce a strict hierarchical URL structure.
2. **Consolidate Gamification:** Move `/leaderboard`, `/stats`, `/milestones`, and `/study-streak` under a unified "Progress" or "Me" section rather than scattered root paths.
3. **Unify Community/Groups:** Resolve the overlapping concepts of "Groups", "Communities", "Language Parties", and "Language Islands" into a single `/discover` or `/community` module.
4. **Standardize Branding:** Choose either "VIP" or "Subscription" as the primary user-facing term and align all routes and UI copy accordingly.
