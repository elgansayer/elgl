# Information Architecture & Route Consolidation Audit

## 1. Goal
To map every user-facing route and major capability, identify overlapping, duplicate, redundant, or contradictory features and navigation paths, and consolidate the product information architecture so every major capability has a clear purpose, entry point, and relationship to the app.

## 2. Identified Route Domains
The application uses feature-based routing modules, aggregating routes into `frontend/src/app/app.routes.ts`:
- `auth.routes.ts`: Authentication, user onboarding, legal documents (`terms`, `privacy`), and support (`support`).
- `media.routes.ts`: Video calls (`video-call`), audio rooms (`audio-rooms`), classrooms, and live broadcasting dashboards.
- `learning.routes.ts`: Vocabulary tracking, flashcards (`decks`, `review`), diagnostic quizzes, and AI tools (`ai-conversation`).
- `commerce.routes.ts`: Subscriptions (`subscription`), coin economy (`coin-economy`), escrow (`escrow`), and virtual shop (`shop`).
- `social.routes.ts`: Discovery (`discovery`), moments feed (`moments`), profiles (`profile`), leaderboards (`leaderboard`), and events (`events`).
- `settings.routes.ts`: App preferences (`settings`), privacy (`settings/privacy`), account management (`settings/account`), and notifications (`settings/notification`).
- `chat.routes.ts`: Core messaging (`chat`), group discovery (`groups`), and chat room settings.
- `admin.routes.ts`: Moderation tools (`admin/moderation`), block management (`admin/blocks`), and user administration (`admin/users`).

## 3. Findings: Duplications & Redundancies
The current architecture delegates component loading to the feature modules (`...authRoutes`, etc.). However, several legacy, top-level routes persist as redirects to domain-specific paths, creating overlapping aliases:

- `/vip` redirects to `subscription` (`commerce.routes.ts`).
- `/my-subscription` redirects to `settings/subscription` (`commerce.routes.ts`).
- `/chat-settings` redirects to `settings/chat` (`chat.routes.ts`).
- `/groups/create` redirects to `community/groups/create` (`chat.routes.ts`).
- `/communities` redirects to `community` (`chat.routes.ts`).
- `/message-filters` redirects to `settings/message-filters` (`chat.routes.ts`).
- `/blocks` redirects to `settings/blocks` (`chat.routes.ts` & `settings.routes.ts`).
- `/settings/notification-customization` redirects to `settings/notification` (`settings.routes.ts`).
- `/language` redirects to `settings/language` (`settings.routes.ts`).
- `/data-storage` redirects to `settings/data-storage` (`settings.routes.ts`).
- `/device-transfer` redirects to `settings/device-transfer` (`settings.routes.ts`).
- `/gdpr` redirects to `settings/gdpr` (`settings.routes.ts`).
- `/account/deletion` redirects to `settings/account/deletion` (`settings.routes.ts`).
- `/version` redirects to `settings/version` (`settings.routes.ts`).
- `/visitors` redirects to `profile/visitors` (`social.routes.ts`).
- `/notification-preferences` redirects to `settings/notification` (`social.routes.ts`).
- `/language-parties` redirects to `community/language-parties` (`social.routes.ts`).
- `/language-islands` redirects to `community/language-islands` (`social.routes.ts`).
- `/help` and `/help-about` redirect to `support` (`auth.routes.ts`).

Some redundancies cross domains, such as `/blocks` being defined in both `chat.routes.ts` and `settings.routes.ts` as a redirect to `settings/blocks`.

## 4. Proposed Consolidation Strategy
1. **Remove Duplicate Definitions**: Eliminate the overlapping alias definitions (e.g., `/blocks` in `chat.routes.ts` should be removed since it belongs to `settings.routes.ts`).
2. **Canonical Mapping**: Maintain legacy unstructured routes only where they serve as critical deep links or historical SEO paths. Otherwise, phase them out in favor of structured hierarchical routes (e.g., all settings under `/settings/`).
3. **Core Entry Alignment**: Ensure the default entry point (`/ai-conversation` in `app.routes.ts`) aligns with the user's primary intent, consolidating the standalone `/home` and `/community` feeds if their purposes overlap.

# Product Information Architecture Audit

Status: source inventory and proposed information architecture. The proposed grouping is not the current route configuration or an approved migration. Preserve legacy deep links and their query parameters. Runtime route files under `frontend/src/app/routes` remain authoritative; root currently redirects to `/ai-conversation`.

## Core Capabilities & Entry Points

### 1. Social & Community
- **Home (`/home`)**: Landing experience summarizing relevant learning and social activity.
- **Moments (`/moments`)**: Multimodal community timeline.
- **Discovery (`/discovery`)**: Partner discovery with filters.
- **Profile (`/profile`, `/profile/:userId`)**: User identity, languages, and relevant activity.
- **Followers / Following (`/profile/:userId/followers`, `/profile/:userId/following`)**: Follow lists.
- **Visitors (`/visitors`, `/profile/visitors`)**: Profile visitor history.
- **Favourites (`/favourites`)**: Bookmarks for messages, corrections, or audio clips.
- **Leaderboard (`/leaderboard`)**: User ranking.
- **Hobby Tags (`/hobby-tags`)**: Hobby tags discovery.
- **Stats (`/stats`)**: Personal usage stats.
- **Milestones (`/milestones`)**: User achievement milestones.
- **Notifications (`/notifications`, `/notification-preferences`)**: Real-time app notifications.
- **Events (`/events`, `/events/calendar`)**: Scheduled language events and live sessions.
- **Community (`/community`, `/language-parties`, `/language-islands`)**: Communities discovery and management.
- **Business Profile (`/business-profile`)**: Business profiles overview.

### 2. Communication & Chat
- **Chat (`/chat`, `/chat/:id`, `/chat-settings`)**: Text and async communication with direct/group messaging.
- **Groups (`/groups`, `/groups/create`, `/communities`, `/join`, `/join/:code`)**: Group access and creation.
- **Message Filters (`/message-filters`, `/blocks`)**: Filters and blocked users.
- **Audio Rooms (`/audio-rooms`, `/voiceroom-notes/:roomId`, `/preview/room/:id`)**: Drop-in voice rooms.
- **Video & Active Calls (`/video-call`, `/active-call`)**: Real-time 1-1 calls via LiveKit.
- **Classrooms (`/classrooms`)**: Video classrooms.
- **Call Logs (`/call-logs`)**: History of calls.
- **Host Dashboard (`/host-dashboard`)**: Management for audio/video hosts.

### 3. Learning & Immersion
- **AI Conversation (`/ai-conversation`, root `/`)**: AI conversational tool.
- **Vocabulary & Flashcards (`/vocabulary`, `/decks`, `/review`)**: SRS workflows.
- **Suggest Flashcards (`/suggest-flashcards`, `/suggest-flashcards/:message`)**: Flashcard creation tool.
- **Lessons & Quests (`/lessons`, `/quests`)**: Structured learning.
- **Reading Engine (`/read`)**: LingQ-style tokenized reading.
- **Diagnostic & Proficiency (`/diagnostic-quiz`, `/proficiency`)**: Skill assessment.
- **Study Buddy (`/study-buddy`)**: Matchmaking for serious learners.
- **Pronunciation Feedback (`/pronunciation-feedback`)**: Audio grading tool.
- **Study Streak (`/study-streak`)**: Visual gamification for consistency.
- **Resource Library (`/resource-library`)**: Library of learning resources.

### 4. Monetization & Economy
- **Subscription (`/vip`, `/subscription`, `/subscription/success`, `/subscription/cancel`, `/my-subscription`, `/settings/subscription`)**: VIP tiers and plans.
- **Coin Economy & Shop (`/coin-economy`, `/coins/success`, `/coins/cancel`, `/shop`, `/sticker-store`, `/cart`)**: Virtual goods, gifts and economy dashboard.
- **Escrow (`/escrow`, `/escrow/:id`)**: Secure payments for tutoring.

### 5. Settings, Legal & Account
- **Settings (`/settings`)**: Main configuration hub for account (`/settings/account`, `/settings/account/deletion`, `/account/deletion`), privacy (`/settings/privacy`, `/settings/gdpr`, `/gdpr`), language (`/language`, `/settings/language`), notifications (`/settings/notification`, `/settings/notification-customization`), chat (`/settings/chat`, `/settings/backup-restore`), appearance (`/settings/appearance`), and storage (`/data-storage`, `/settings/data-storage`).
- **Blocks & Message Filters (`/settings/blocks`, `/settings/message-filters`)**: Moderation and filtering settings.
- **Linked Accounts & Device Transfer (`/settings/linked-accounts`, `/device-transfer`, `/settings/device-transfer`)**: Account management.
- **Admin & Developer (`/admin`, `/admin/lessons`, `/admin/moderation`, `/admin/blocks`, `/admin/users`, `/developer`)**: Moderation and internal tooling.
- **Legal & Support (`/terms`, `/privacy`, `/help`, `/support`, `/help-about`)**: Legal documentation and help center.
- **Security & Authentication (`/onboarding`, `/forgot-password`, `/reset-password`, `/change-password`, `/lock`)**: Auth workflows.
- **Version (`/version`, `/settings/version`)**: Version checks.

---

## Overlapping, Redundant, and Contradictory Routes

### 1. Confusing/Redundant Redirects
Many URLs exist solely as aliases to primary paths, leading to a sprawling surface area:
- `/help` and `/help-about` redirect to `/support`.
- `/vip` redirects to `/subscription`.
- `/my-subscription` redirects to `/settings/subscription`.
- `/communities` redirects to `/community`.
- `/groups/create` redirects to `/community/groups/create`.
- `/language-parties` and `/language-islands` redirect to `/community/language-parties` and `/community/language-islands`.
- `/message-filters` and `/blocks` redirect to `/settings/message-filters` and `/settings/blocks`.
- `/data-storage`, `/device-transfer`, `/gdpr`, `/version`, `/account/deletion`, `/language`, `/chat-settings` redirect to `/settings/...`.
- `/notification-preferences` and `/settings/notification-customization` redirect to `/settings/notification`.
- `/visitors` redirects to `/profile/visitors`.

- Preserve existing compatibility redirects for bookmarks, notifications and inbound links. New navigation may use canonical destinations; route removal requires a separate migration backed by usage evidence and redirect/query-parameter tests.

### 2. Community vs. Groups vs. Events
- We have `/community`, `/communities`, `/groups`, and `/events`.
- `/community` serves as a root for `/language-parties` and `/language-islands`, but `/events` exists independently.
- **Consolidation Recommendation**: Merge `/groups` and `/events` under `/community` to create a single destination for multi-user social interaction.

### 3. AI Conversation as Root
- The root path (`/`) redirects to `/ai-conversation`, bypassing `/home`. However, `/home` contains the study streak, word of the day, and daily learning tips.
- The current root redirects to `/ai-conversation`. Changing the default landing page is a product proposal requiring explicit acceptance criteria and navigation tests; it is not an implemented correction in this report.

### 4. Fragmented Learning Hub
- `/vocabulary`, `/decks`, `/review`, `/lessons`, `/quests`, `/read`, `/resource-library`, `/study-buddy`, `/diagnostic-quiz`, `/proficiency`, `/pronunciation-feedback`, `/study-streak` all live at the top-level route space.
- **Consolidation Recommendation**: Group these under a `/learn` or `/study` parent route to simplify the top-level namespace and create a dedicated learning hub.

### 5. Profile Analytics & Settings
- `/stats` and `/milestones` are top-level but conceptually belong to the user's profile.
- **Consolidation Recommendation**: Move `/stats` and `/milestones` to `/profile/stats` and `/profile/milestones`.

