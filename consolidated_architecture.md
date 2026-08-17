# HelloTalk Information Architecture Consolidation

## Current Routes & Capabilities
* **Core/Onboarding:** ``, `onboarding`, `diagnostic-quiz`, `proficiency`, `lock`, `home`, `version`
* **Social & Discovery:** `discovery`, `moments`, `groups`, `groups/create`, `communities`, `leaderboard`, `favourites`, `hobby-tags`, `language-islands`, `language-parties`, `events`, `events/calendar`, `join`, `join/:code`
* **Communication:** `audio-rooms`, `preview/room/:id`, `voiceroom-notes/:roomId`, `chat`, `chat/:id`, `video-call`, `active-call`, `call-logs`, `voip-call`
* **Learning & Practice:** `classrooms`, `suggest-flashcards`, `suggest-flashcards/:message`, `vocabulary`, `decks`, `review`, `pronunciation-feedback`, `study-buddy`, `read`, `resource-library`, `study-streak`, `milestones`, `quests`, `lessons`, `ai-conversation`
* **Profiles:** `business-profile`, `profile`, `profile/:userId`, `profile/:userId/followers`, `profile/:userId/following`, `visitors`, `profile/visitors`
* **Monetisation & Economy:** `vip`, `subscription`, `subscription/success`, `subscription/cancel`, `my-subscription`, `coins/success`, `coins/cancel`, `coin-economy`, `shop`, `sticker-store`, `cart`, `escrow`, `escrow/:id`
* **Settings & User Management:** `settings`, `settings/account`, `settings/notification`, `settings/notification-customization`, `settings/message-filters`, `message-filters`, `settings/appearance`, `settings/privacy`, `settings/backup-restore`, `settings/linked-accounts`, `notification-preferences`, `notifications`, `forgot-password`, `reset-password`, `change-password`, `device-transfer`, `host-dashboard`, `language`, `blocks`, `chat-settings`, `data-storage`, `account/deletion`
* **Admin & Support:** `developer`, `admin`, `admin/lessons`, `admin/moderation`, `admin/blocks`, `admin/users`, `terms`, `privacy`, `help`, `support`, `help-about`, `gdpr`, `stats`

## Identified Overlaps & Redundancies

1. **Proficiency vs. Diagnostic Quiz:**
   - `/proficiency` and `/diagnostic-quiz` appear to serve the exact same purpose. Consolidate to `/diagnostic-quiz` (or `/proficiency`) to avoid confusion.

2. **Communities vs. Groups:**
   - `/groups` and `/communities` represent overlapping concepts. "Communities" might encompass groups, or vice-versa. Consolidate into a single `/communities` (with internal groupings if necessary).

3. **Profile Visitors:**
   - Both `/visitors` and `/profile/visitors` exist. Standardise on `/profile/visitors`.

4. **Subscriptions:**
   - `/vip`, `/subscription`, and `/my-subscription` are highly overlapping. `/vip` typically represents premium, `/subscription` might be generic, `/my-subscription` is user-specific. Consolidate management to `/settings/subscription` and the upgrade path to `/premium` or just `/vip`.

5. **Message Filters:**
   - `/settings/message-filters` and `/message-filters` are redundant. Standardise on `/settings/message-filters`.

6. **Help & Support:**
   - `/help`, `/support`, and `/help-about` serve overlapping needs. Consolidate into `/support` (with an "About" section inside it).

7. **Blocks Management:**
   - `/blocks` vs `/admin/blocks`. Assuming `/blocks` is for regular users to manage their own blocked contacts, it should be moved to `/settings/blocks`.

8. **Notification Preferences:**
   - `/settings/notification`, `/settings/notification-customization`, and `/notification-preferences` overlap heavily. Consolidate into `/settings/notifications`.

## Proposed Consolidated Architecture

### 1. Main Navigation (Bottom Tab/Sidebar)
- `/home` - Dashboard and primary landing.
- `/chat` - Direct and group messaging inbox.
- `/moments` - Global social feed.
- `/discovery` - Matchmaking and partner search.
- `/profile` - The active user's profile.

### 2. Communication & Social
- `/chat/:id` - Chat room.
- `/audio-rooms` - Live voice rooms.
- `/video-call` & `/active-call` - Real-time communication.
- `/communities` - Central directory for groups, events, and language parties.

### 3. Learning & Immersion
- `/vocabulary` - Dashboard for flashcards and decks.
- `/read` - Immersive reading engine.
- `/lessons` & `/classrooms` - Structured learning content.
- `/study-streak` - Gamification metrics.

### 4. Profiles & Monetisation
- `/profile/:userId` - External profile view.
- `/vip` - Premium features pitch and subscription management.
- `/shop` - Virtual goods and economy interactions.

### 5. Settings Hub (`/settings`)
- `/settings/account` - Credentials and linked accounts.
- `/settings/privacy` - Block management, visibility, and GDPR.
- `/settings/notifications` - Unified notification preferences.
- `/settings/chat` - Message filters, backups, and appearance.
- `/settings/language` - Language and learning targets.
- `/support` - Unified help centre, FAQs, and legal terms.
