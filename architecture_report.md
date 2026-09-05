# Information Architecture Report & Route Mapping

## Overlapping, Duplicate, and Redundant Routes

### Admin Portal Duplication
- **Frontend App:** `/admin`, `/admin/lessons`, `/admin/moderation`, `/admin/blocks`, `/admin/users`
- **Admin Portal (Standalone App):** `/login`, `/access-denied`, `/`, `/users`, `/users/:id`, `/moderation`, `/network-security`, `/roles`, `/roles/assignments`, `/audit`, `/logs`, `/system`, `**`
- **Recommendation:** Remove the `adminRoutes` (except `/developer`) from the main user-facing frontend app. The main app should not contain admin functionality since there is a dedicated standalone Admin Portal application (`admin-portal`). This consolidates admin activities entirely into the separate portal for better security and separation of concerns.

### Redundant Alias/Redirect Paths
The codebase contains numerous redirect paths that duplicate existing functionality. These should be documented but **NOT** deleted, to preserve backwards compatibility, external links, deep links, and user bookmarks:
- **Settings Redundancies:**
  - `/settings/notification-customization` -> `/settings/notification`
  - `/language` -> `/settings/language`
  - `/blocks` -> `/settings/blocks` (and also in chat routes: `/blocks` -> `/settings/blocks`)
  - `/data-storage` -> `/settings/data-storage`
  - `/device-transfer` -> `/settings/device-transfer`
  - `/gdpr` -> `/settings/gdpr`
  - `/account/deletion` -> `/settings/account/deletion`
  - `/version` -> `/settings/version`
  - `/chat-settings` -> `/settings/chat`
  - `/message-filters` -> `/settings/message-filters`
- **Community/Social Redundancies:**
  - `/visitors` -> `/profile/visitors`
  - `/notification-preferences` -> `/settings/notification`
  - `/language-parties` -> `/community/language-parties`
  - `/language-islands` -> `/community/language-islands`
  - `/groups/create` -> `/community/groups/create`
  - `/communities` -> `/community`
- **Commerce Redundancies:**
  - `/vip` -> `/subscription`
  - `/my-subscription` -> `/settings/subscription`
- **Help Redundancies:**
  - `/help` -> `/support`
  - `/help-about` -> `/support`

## Consolidated Product Information Architecture

### 1. Main Navigation & Feed (Home)
**Entry Point:** `/home`
**Purpose:** Primary dashboard and starting point.
- **Related Routes:**
  - `/ai-conversation`
  - `/moments`
  - `/discovery`
  - `/events`, `/events/calendar`

### 2. Social & Community
**Entry Point:** `/community`
**Purpose:** Connecting with other users, discovering groups, and shared interests.
- **Related Routes:**
  - Groups: `/groups`, `/join`, `/join/:code`
  - Interaction: `/leaderboard`, `/hobby-tags`, `/business-profile`

### 3. Messaging & Communication
**Entry Point:** `/chat`
**Purpose:** Direct messaging and active conversation rooms.
- **Related Routes:**
  - Chat Rooms: `/chat/:id`
  - Media Calls: `/active-call`, `/video-call`, `/audio-rooms`, `/call-logs`
  - Voicerooms: `/voiceroom-notes/:roomId`, `/preview/room/:id`, `/host-dashboard`

### 4. Learning & Education
**Entry Point:** `/lessons`
**Purpose:** Core educational features, study tools, and tracking progress.
- **Related Routes:**
  - Learning material: `/read`, `/classrooms`, `/resource-library`
  - Flashcards: `/decks`, `/review`, `/suggest-flashcards`, `/suggest-flashcards/:message`, `/vocabulary`
  - Assessment: `/diagnostic-quiz`, `/proficiency`, `/pronunciation-feedback`
  - Progress: `/quests`, `/study-streak`, `/stats`, `/milestones`
  - Matching: `/study-buddy`

### 5. Commerce & Economy
**Entry Point:** `/shop`
**Purpose:** Monetisation, premium features, and virtual currency.
- **Related Routes:**
  - Subscriptions: `/subscription`, `/subscription/success`, `/subscription/cancel`, `/settings/subscription`
  - Coins/Currency: `/coin-economy`, `/coins/success`, `/coins/cancel`
  - E-Commerce: `/sticker-store`, `/cart`, `/escrow`, `/escrow/:id`

### 6. User Profile & Identity
**Entry Point:** `/profile`
**Purpose:** Personal identity, followers, and user details.
- **Related Routes:**
  - Details: `/profile/:userId`
  - Connections: `/profile/:userId/followers`, `/profile/:userId/following`, `/profile/visitors`
  - Saved: `/favourites`

### 7. Settings & Configuration
**Entry Point:** `/settings`
**Purpose:** Managing app preferences, account details, and privacy.
- **Related Routes:**
  - Account: `/settings/account`, `/settings/account/deletion`, `/settings/linked-accounts`
  - Preferences: `/settings/language`, `/settings/appearance`, `/settings/notification`, `/settings/chat`, `/settings/message-filters`
  - Security/Privacy: `/settings/privacy`, `/settings/blocks`, `/settings/gdpr`
  - App Data: `/settings/data-storage`, `/settings/device-transfer`, `/settings/backup-restore`, `/settings/version`

### 8. Authentication & Onboarding
**Entry Point:** `/onboarding`
**Purpose:** Entry, recovery, and legal agreements.
- **Related Routes:**
  - Password Management: `/forgot-password`, `/reset-password`, `/change-password`, `/lock`
  - Legal/Help: `/terms`, `/privacy`, `/support`
