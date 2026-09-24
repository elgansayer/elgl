# HelloTalk Product Information Architecture Map

## 1. Executive Summary
This document provides a comprehensive mapping of all user-facing routes and major capabilities within the HelloTalk application. It identifies overlapping, duplicate, redundant, and contradictory features and navigation paths, proposing a consolidated product information architecture for clear purpose, entry points, and relationships.

## 2. Capability Mapping & Route Analysis

### 2.1 Core App Entry & Navigation
- **`/` (Root):** Redirects to `/ai-conversation`. *Critique: Redirecting to a specific tool rather than a general dashboard or home feed might not align with user expectations for a social learning app.*
- **`/home`:** `HomeComponent`. The intended landing experience summarising learning and social activity.
- **`/**` (Fallback):** Redirects to `/ai-conversation`. *Critique: Should ideally redirect to `/home` or a dedicated 404 page.*

### 2.2 Social & Community
- **`/community`:** `CommunitiesComponent`. The primary entry point for community features.
- **`/groups`:** `GroupsDiscoveryComponent`. Group discovery.
- **`/join` & `/join/:code`:** `JoinGroupComponent`.
- **Redundancies/Redirects:**
  - `/communities` -> `/community`
  - `/groups/create` -> `/community/groups/create`
  - `/language-parties` -> `/community/language-parties`
  - `/language-islands` -> `/community/language-islands`
- *Consolidation:* The concept of "groups", "communities", "language parties", and "language islands" seem overlapping. They should all be unified under the `/community` umbrella with clear sub-routes.

### 2.3 User Profiles & Interactions
- **`/profile` & `/profile/:userId`:** `ProfileComponent` & `UserDetailComponent`.
- **`/profile/:userId/followers` & `/profile/:userId/following`:** `FollowListComponent`.
- **`/profile/visitors`:** `ProfileVisitorsComponent`. (Redirect: `/visitors` -> `/profile/visitors`)
- **`/favourites`, `/leaderboard`, `/hobby-tags`, `/stats`, `/milestones`:** Various social components.
- **`/business-profile`:** `BusinessProfileComponent`.

### 2.4 Communication & Chat
- **`/chat` & `/chat/:id`:** `ChatListComponent` & `ChatRoomPageComponent`.
- **Redundancies/Redirects:**
  - `/chat-settings` -> `/settings/chat`
  - `/message-filters` -> `/settings/message-filters`
  - `/blocks` -> `/settings/blocks` (Note: Defined in both `chat.routes.ts` and `settings.routes.ts`)

### 2.5 Media & Live Rooms
- **`/audio-rooms`:** `AudioRoomComponent`. LiveKit room discovery.
- **`/classrooms`:** `ClassroomsMarketplace`. Video classrooms.
- **`/video-call` & `/active-call`:** Real-time calling surfaces.
- **`/call-logs`:** Call history.
- **`/voiceroom-notes/:roomId` & `/preview/room/:id` & `/host-dashboard`:** Room management and participation.

### 2.6 Learning & Immersion
- **`/vocabulary`, `/decks`, `/review`, `/suggest-flashcards`:** SRS vocabulary and flashcard features.
- **`/diagnostic-quiz`, `/proficiency`:** Assessment tools.
- **`/lessons`, `/quests`, `/read`, `/resource-library`:** Structured learning content.
- **`/pronunciation-feedback`, `/study-streak`:** Learning tracking and feedback.
- **`/study-buddy`:** Partner matching.
- **`/ai-conversation`:** AI practice. (Currently the default route)

### 2.7 Commerce & Monetization
- **`/subscription` & `/settings/subscription`:** Subscription management. (Redirects: `/vip` -> `/subscription`, `/my-subscription` -> `/settings/subscription`)
- **`/coins/success`, `/coins/cancel`, `/coin-economy`:** Virtual currency features.
- **`/shop`, `/sticker-store`, `/cart`:** Virtual goods store.
- **`/escrow` & `/escrow/:id`:** Payment management.

### 2.8 Settings, Legal & Admin
- **`/settings`:** Main settings component.
- **Sub-settings:** `/settings/account`, `/settings/notification`, `/settings/message-filters`, `/settings/appearance`, `/settings/language`, `/settings/privacy`, `/settings/blocks`, `/settings/backup-restore`, `/settings/linked-accounts`, `/settings/data-storage`, `/settings/device-transfer`, `/settings/gdpr`, `/settings/account/deletion`, `/settings/version`.
- **Redundancies/Redirects:** Many root-level paths (e.g., `/language`, `/data-storage`, `/version`) redirect to their respective `/settings/...` path. This is good consolidation, but the redundant route definitions can be confusing.
- **Legal/Auth:** `/onboarding`, `/forgot-password`, `/reset-password`, `/change-password`, `/lock`, `/terms`, `/privacy`, `/support`. (Redirects: `/help` -> `/support`, `/help-about` -> `/support`)
- **Admin:** `/admin`, `/admin/lessons`, `/admin/moderation`, `/admin/blocks`, `/admin/users`, `/developer`.

## 3. Identified Issues & Recommendations

### 3.1 Overlapping & Redundant Routes
- **Issue:** The `blocks` path is defined in both `chat.routes.ts` and `settings.routes.ts`, both redirecting to `settings/blocks`.
- **Recommendation:** Remove the duplicate definition in `chat.routes.ts` to maintain a single source of truth in `settings.routes.ts`.
- **Issue:** Numerous root-level aliases exist (e.g., `/vip`, `/my-subscription`, `/visitors`, `/language`, `/version`, `/help`) that merely redirect to deeper, more structured paths (e.g., `/subscription`, `/settings/subscription`, `/profile/visitors`, `/settings/language`, `/settings/version`, `/support`).
- **Recommendation:** While aliases can be useful for legacy URLs, they clutter the routing configuration. Ensure these are clearly marked as legacy redirects or removed if no longer necessary.

### 3.2 Misaligned Default Route
- **Issue:** The application defaults (`''` and `**`) redirect to `/ai-conversation`. This bypasses the intended `/home` landing experience described in the architecture documents (`ui_architecture.md`).
- **Recommendation:** Update `app.routes.ts` to redirect `''` and `**` to `/home` to provide a holistic view of the user's social and learning activities upon entry.

### 3.3 Community Consolidation
- **Issue:** Fragmentation between `/community`, `/communities`, `/groups`, `/language-parties`, and `/language-islands`.
- **Recommendation:** Consolidate the UI and routing under a unified `/community` tab. Use nested routes effectively:
  - `/community` (Overview)
  - `/community/groups`
  - `/community/events` (Consolidating language parties and islands)

### 3.4 Feature Categorization
- **Issue:** The purpose of some features overlaps. `study-buddy` (Learning) and `discovery` (Social) both involve matching with users.
- **Recommendation:** Clarify the distinction. `discovery` should focus on broad language exchange partners, while `study-buddy` should be distinctly positioned for serious, perhaps structured, learning commitments.

## 4. Proposed Consolidated Architecture

1.  **Main Navigation (Bottom Tabs):**
    *   **Home (`/home`):** Personalized feed, quick actions, streaks.
    *   **Community (`/community`):** Groups, Discovery, Moments, Events.
    *   **Learn (`/learn` - *Proposed*):** Consolidate Lessons, Quests, Vocabulary, AI Conversation.
    *   **Chat (`/chat`):** Messages, Active Calls.
    *   **Profile (`/profile`):** User details, Stats, Settings access.

2.  **Settings Hierarchy (`/settings/...`):**
    *   Maintain the existing structured hierarchy under `/settings`, deprecating root-level aliases where possible.

3.  **Commerce Integration:**
    *   Access `/subscription` and `/shop` primarily through the Profile or relevant context prompts rather than top-level tabs.

This consolidated structure ensures every capability has a clear entry point, reduces cognitive load for the user, and aligns the application with its core mission of social language exchange and structured learning.
