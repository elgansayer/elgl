# HelloTalk Product Architecture & Route Mapping

This document consolidates the product information architecture, mapping major capabilities, identifying redundancies, and proposing a streamlined structure.

## 1. Current Route Map & Capabilities

The application is structured into the following domains based on the Angular routing configuration (`frontend/src/app/routes/`):

### App Shell & Discovery
*   `/home`: Main landing dashboard (`HomeComponent`)
*   `/ai-conversation`: Default redirect from root, AI chat (`AiConversationComponent`)

### Social & Discovery (`social.routes.ts`)
*   `/discovery`: Partner matchmaking (`DiscoveryComponent`)
*   `/moments`: Public community feed (`MomentsFeedComponent`)
*   `/profile`, `/profile/:userId`: User profiles and details
*   `/followers`, `/following`: Network lists
*   `/visitors`: Profile view tracking (Redirects to `/profile/visitors`)
*   `/favourites`: Saved items (`FavouritesComponent`)
*   `/leaderboard`: Gamification ranking (`LeaderboardComponent`)
*   `/hobby-tags`: Interest selection (`HobbyTagsComponent`)
*   `/stats`, `/milestones`: User engagement metrics
*   `/notifications`: Activity inbox (`NotificationsInboxComponent`)
*   `/events`, `/events/calendar`: Scheduled community activities
*   `/language-parties`: (Redirects to `/community/language-parties`)
*   `/language-islands`: (Redirects to `/community/language-islands`)
*   `/business-profile`: Commercial user identity

### Chat & Communities (`chat.routes.ts`, `app.routes.ts`)
*   `/chat`, `/chat/:id`: Direct and group messaging
*   `/community`: Top-level community hub (`CommunitiesComponent`)
*   `/communities`: (Redirects to `/community`)
*   `/groups`: Group discovery (`GroupsDiscoveryComponent`)
*   `/groups/create`: (Redirects to `/community/groups/create`)
*   `/join`, `/join/:code`: Group join flows

### Media & Broadcasting (`media.routes.ts`)
*   `/audio-rooms`: Drop-in voice chat (LiveKit)
*   `/classrooms`: Video teaching marketplace
*   `/video-call`, `/active-call`: 1-on-1 and group video
*   `/call-logs`: Historical call records
*   `/voiceroom-notes/:roomId`: Shared notes for audio sessions
*   `/preview/room/:id`: Room landing page
*   `/host-dashboard`: Broadcaster management

### Learning & Immersion (`learning.routes.ts`)
*   `/vocabulary`: Word mastery dashboard
*   `/decks`, `/review`: Flashcard SRS system
*   `/suggest-flashcards`: AI-driven content creation
*   `/diagnostic-quiz`, `/proficiency`: Level assessment
*   `/lessons`: Structured curricula
*   `/quests`: Gamified learning goals
*   `/read`: Interactive text consumption (LingQ style)
*   `/resource-library`: Static learning materials
*   `/pronunciation-feedback`: AI speech scoring
*   `/study-streak`: Engagement tracking
*   `/study-buddy`: Focused learning partner matchmaking

### Commerce & Economy (`commerce.routes.ts`)
*   `/subscription`: VIP plan selection (Redirects from `/vip`)
*   `/my-subscription`: Management (Redirects to `/settings/subscription`)
*   `/subscription/success`, `/subscription/cancel`: Payment flows
*   `/coin-economy`: Virtual currency dashboard
*   `/coins/success`, `/coins/cancel`: Coin purchase flows
*   `/shop`, `/sticker-store`, `/cart`: Virtual goods storefront
*   `/escrow`, `/escrow/:id`: Secure payment holding for tutoring

### Administration (`admin.routes.ts`)
*   `/admin`: Operational hub
*   `/admin/lessons`, `/admin/moderation`, `/admin/blocks`, `/admin/users`: Management portals
*   `/developer`: API access and creator tools

### Settings & Identity (`settings.routes.ts`, `auth.routes.ts`)
*   `/settings`: Main preferences hub
*   `/settings/account`, `/settings/notification`, `/settings/message-filters`, `/settings/appearance`, `/settings/language`, `/settings/privacy`, `/settings/blocks`, `/settings/data-storage`: Specific preference panels
*   `/settings/backup-restore`: Chat history management
*   `/settings/linked-accounts`, `/settings/device-transfer`: Cross-platform identity
*   `/settings/gdpr`, `/settings/account/deletion`: Compliance flows
*   `/onboarding`, `/forgot-password`, `/reset-password`, `/change-password`: Authentication lifecycle
*   `/lock`: App security
*   `/terms`, `/privacy`: Legal documents
*   `/support`: Help center (Redirects from `/help`, `/help-about`)

---

## 2. Identified Overlaps & Redundancies

Based on the routing structure, the following areas exhibit overlapping intent, duplicate paths, or scattered hierarchy:

### A. Community vs. Groups vs. Events
*   **Issue:** The app has overlapping concepts for social gatherings. `/community` acts as a top-level route, but `/groups` is a separate route that partially redirects into `/community/groups/create`. `/language-parties` and `/language-islands` redirect into `/community/*`.
*   **Redundancy:** Users can access similar finding interfaces via `/groups` and `/community`.
*   **Resolution:** Consolidate all group/community discovery under `/community`. `/groups` should strictly be a child route of `/community` (e.g., `/community/groups`), acting as the directory.

### B. The Settings Labyrinth
*   **Issue:** Settings routes are heavily aliased. `/language` redirects to `/settings/language`, `/blocks` redirects to `/settings/blocks`, `/data-storage` redirects to `/settings/data-storage`, etc. (See `grep` output). This indicates features were built top-level and later moved, or that deep links exist that haven't been unified.
*   **Redundancy:** Furthermore, `/settings/chat` exists, but there's a top-level `/chat-settings` redirect. `/notification-preferences` redirects to `/settings/notification`, while `/settings/notification-customization` also redirects to `/settings/notification`.
*   **Resolution:** Enforce a strict hierarchy where all user-configurable preferences live exclusively under `/settings/*`. Deprecate the top-level aliases in documentation to encourage unified navigation via the Settings hub.

### C. Matching: Discovery vs. Study Buddy
*   **Issue:** The app has two distinct matching engines: `/discovery` (general social matching) and `/study-buddy` (serious learner matching).
*   **Redundancy:** While the intent differs (casual vs. serious), the underlying mechanics (searching for users by language criteria) are nearly identical.
*   **Resolution:** Merge the entry point into a unified `/discovery` interface with a prominent toggle or tab for "Serious Study Mode", reducing navigational complexity.

### D. VIP and Subscription Aliasing
*   **Issue:** `/vip` redirects to `/subscription`. `/my-subscription` redirects to `/settings/subscription`.
*   **Resolution:** Standardize the terminology. If the brand uses "VIP", the routes should reflect it (e.g., `/vip` for the pitch, `/settings/vip` for management).

---

## 3. Consolidated Information Architecture Proposal

Every major capability must have a single, unambiguous entry point.

### Primary Navigation Tabs (Bottom Bar / Sidebar)
1.  **Home / Moments (`/home` or `/moments`)**: The default feed for ambient engagement.
2.  **Chat (`/chat`)**: Direct and group messaging inbox.
3.  **Learn (`/learn`)**: *New structural root*.
    *   Consolidates `/lessons`, `/vocabulary`, `/read`, `/diagnostic-quiz`.
4.  **Community (`/community`)**: *Unified hub*.
    *   Consolidates `/discovery` (Partner Search), `/groups`, `/audio-rooms`, `/events`.
5.  **Profile (`/profile`)**: User identity and stats.

### Secondary Hubs (Accessible via Profile or Dedicated Menus)
*   **Settings (`/settings`)**: Strict parent for all configurations (`/settings/account`, `/settings/privacy`, `/settings/language`, etc.). No top-level aliases.
*   **Store (`/shop`)**: Consolidated hub for `/subscription` (VIP), `/coin-economy`, and `/sticker-store`.
*   **Admin (`/admin`)**: Operational control.

By adopting this structure, the app reduces cognitive load by grouping related capabilities (e.g., placing LiveKit audio rooms and text-based groups under the same "Community" umbrella) and eliminating redundant top-level routing aliases.
