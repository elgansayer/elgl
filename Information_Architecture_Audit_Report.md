# HelloTalk - Information Architecture Audit Report

## 1. Overview
This report maps all user-facing routes and major capabilities in the HelloTalk application. It identifies overlapping, duplicate, redundant, or contradictory features and navigation paths, and proposes a consolidated product information architecture.

## 2. Current Route Mapping

### Core App Routes (`app.routes.ts`)
- `/` -> Redirects to `ai-conversation`
- `/home` -> HomeComponent
- `/community` -> CommunitiesComponent
- `**` -> Redirects to `ai-conversation`

### Auth & Onboarding (`auth.routes.ts`)
- `/onboarding` -> OnboardingWizardComponent
- `/forgot-password` -> ForgotPasswordComponent
- `/reset-password` -> ResetPasswordComponent
- `/change-password` -> ChangePasswordComponent
- `/lock` -> DeviceLockComponent
- `/terms` -> TermsComponent
- `/privacy` -> PrivacyComponent
- `/support` -> SupportCentreComponent
- `/help` -> Redirects to `/support`
- `/help-about` -> Redirects to `/support`

### Social Features (`social.routes.ts`)
- `/discovery` -> DiscoveryComponent
- `/moments` -> MomentsFeedComponent
- `/profile` -> ProfileComponent
- `/profile/:userId` -> UserDetailComponent
- `/profile/:userId/followers` -> FollowListComponent
- `/profile/:userId/following` -> FollowListComponent
- `/profile/visitors` -> ProfileVisitorsComponent
- `/visitors` -> Redirects to `/profile/visitors`
- `/favourites` -> FavouritesComponent
- `/leaderboard` -> LeaderboardComponent
- `/hobby-tags` -> HobbyTagsComponent
- `/stats` -> MyStatsComponent
- `/milestones` -> MilestoneComponent
- `/notifications` -> NotificationsInboxComponent
- `/notification-preferences` -> Redirects to `settings/notification`
- `/events` -> EventsFeedComponent
- `/events/calendar` -> EventsCalendarComponent
- `/language-parties` -> Redirects to `community/language-parties`
- `/language-islands` -> Redirects to `community/language-islands`
- `/business-profile` -> BusinessProfileComponent

### Chat & Messaging (`chat.routes.ts`)
- `/chat` -> ChatListComponent
- `/chat/:id` -> ChatRoomPageComponent
- `/groups` -> GroupsDiscoveryComponent
- `/join` -> JoinGroupComponent
- `/join/:code` -> JoinGroupComponent
- `/communities` -> Redirects to `community`
- `/groups/create` -> Redirects to `community/groups/create`
- `/chat-settings` -> Redirects to `settings/chat`
- `/message-filters` -> Redirects to `settings/message-filters`
- `/blocks` -> Redirects to `settings/blocks`

### Media & Rooms (`media.routes.ts`)
- `/audio-rooms` -> AudioRoomComponent
- `/classrooms` -> ClassroomsMarketplace
- `/video-call` -> VideoCallComponent
- `/call-logs` -> CallLogsComponent
- `/active-call` -> ActiveCallComponent
- `/voiceroom-notes/:roomId` -> VoiceroomNotesComponent
- `/preview/room/:id` -> VoiceroomPreviewComponent
- `/host-dashboard` -> HostDashboardComponent

### Learning & Education (`learning.routes.ts`)
- `/ai-conversation` -> AiConversationComponent
- `/lessons` -> LessonsComponent
- `/vocabulary` -> VocabularyDashboardComponent
- `/decks` -> FlashcardDeckComponent
- `/review` -> FlashcardReviewComponent
- `/suggest-flashcards` -> SuggestFlashcardsComponent
- `/suggest-flashcards/:message` -> SuggestFlashcardsComponent
- `/diagnostic-quiz` -> DiagnosticQuizComponent
- `/proficiency` -> ProficiencyAssessmentComponent
- `/quests` -> QuestsComponent
- `/read` -> ReadingEngineComponent
- `/resource-library` -> ResourceLibraryComponent
- `/pronunciation-feedback` -> PronunciationFeedbackComponent
- `/study-streak` -> StudyStreakCounterComponent
- `/study-buddy` -> StudyBuddyComponent

### Commerce & Economy (`commerce.routes.ts`)
- `/subscription` -> SubscriptionPageComponent
- `/subscription/success` -> SubscriptionSuccessComponent
- `/subscription/cancel` -> SubscriptionCancelComponent
- `/vip` -> Redirects to `subscription`
- `/settings/subscription` -> MySubscriptionComponent
- `/my-subscription` -> Redirects to `settings/subscription`
- `/coin-economy` -> CoinEconomyDashboardComponent
- `/coins/success` -> CoinsSuccessComponent
- `/coins/cancel` -> CoinsCancelComponent
- `/shop` -> ShopComponent
- `/sticker-store` -> StickerStoreComponent
- `/cart` -> CartComponent
- `/escrow` -> EscrowComponent
- `/escrow/:id` -> EscrowDetailComponent

### Settings & Configuration (`settings.routes.ts`)
- `/settings` -> SettingsComponent
- `/settings/account` -> AccountSettingsComponent
- `/settings/account/deletion` -> AccountDeletionComponent
- `/account/deletion` -> Redirects to `settings/account/deletion`
- `/settings/chat` -> ChatSettingsComponent
- `/settings/notification` -> NotificationSettingsComponent
- `/settings/notification-customization` -> Redirects to `settings/notification`
- `/settings/message-filters` -> MessageFilterSettingsComponent
- `/settings/appearance` -> AppearanceSettingsComponent
- `/settings/language` -> LanguageSettingsComponent
- `/language` -> Redirects to `settings/language`
- `/settings/privacy` -> PrivacySettingsComponent
- `/settings/blocks` -> BlockManagementComponent
- `/blocks` -> Redirects to `settings/blocks`
- `/settings/backup-restore` -> BackupRestoreComponent
- `/settings/linked-accounts` -> LinkedAccountsComponent
- `/settings/data-storage` -> DataStorageComponent
- `/data-storage` -> Redirects to `settings/data-storage`
- `/settings/device-transfer` -> DeviceTransferComponent
- `/device-transfer` -> Redirects to `settings/device-transfer`
- `/settings/gdpr` -> GdprComponent
- `/gdpr` -> Redirects to `settings/gdpr`
- `/settings/version` -> VersionCheckComponent
- `/version` -> Redirects to `settings/version`

### Admin & Moderation (`admin.routes.ts` & `moderation.routes.ts`)
- `/admin` -> AdminPortalComponent
- `/admin/lessons` -> LessonManagerComponent
- `/admin/moderation` -> ModerationQueueComponent
- `/admin/blocks` -> AdminBlocksComponent
- `/admin/users` -> AdminUsersComponent
- `/developer` -> DeveloperDashboardComponent
- `/moderation` -> ModerationDashboardComponent

## 3. Findings: Overlaps, Duplicates, and Redundancies

### Inconsistent Base Navigation
The default catch-all and root paths redirect to `ai-conversation`, but `home` exists separately.
Users navigating to `/` or an unknown route are immediately thrust into the AI conversation, which skips typical app discovery phases and can be disorienting compared to a unified home dashboard.

### Fragmented Social Capabilities
- `/discovery`, `/community`, and `/groups` represent fragmented ways of finding other users and content.
- `/language-parties` and `/language-islands` act as community redirects but lack primary distinct locations.
- `/hobby-tags` and `/favourites` sit loosely at the top level without a clear grouping under profile or discovery.

### Learning Tool Dispersal
- The learning section has many disparate top-level endpoints: `/vocabulary`, `/decks`, `/review`, `/diagnostic-quiz`, `/proficiency`, `/lessons`, `/quests`, `/read`, `/resource-library`, `/study-streak`, `/study-buddy`.
- Many of these overlap logically. Flashcards (`/decks`, `/review`, `/suggest-flashcards`, `/vocabulary`) should be a unified capability. Assessments (`/diagnostic-quiz`, `/proficiency`) serve the same goal.

### Media Sprawl
- `/audio-rooms`, `/voiceroom-notes/:roomId`, and `/preview/room/:id` handle voice rooms.
- `/classrooms` and `/video-call` handle video.
- `/active-call` and `/call-logs` relate to both.

### Commerce Overlaps
- `/shop` vs. `/sticker-store` are redundant top-level commerce categories.
- `/vip`, `/my-subscription`, `/subscription` all handle premium features but span different root aliases.
- `/coin-economy`, `/coins/*` manages virtual currency but could be grouped into a unified wallet/economy centre.

### Confusing Redirect Overloads
- Many routes have top-level aliases that redirect into deeper structures (e.g., `/vip` -> `subscription`, `/blocks` -> `settings/blocks`, `/gdpr` -> `settings/gdpr`). This pollutes the top-level namespace and complicates routing tables.

## 4. Consolidated Information Architecture Proposal

Every major capability is grouped with a clear purpose and single entry point.

### Level 1: Primary Navigation
1. **Home (`/home`)**: The primary dashboard summarizing social feed, active learning streaks, and quick links.
2. **Chat (`/chat`)**: Centralised messaging (1:1, groups, communities).
3. **Discover (`/discover`)**: Unified social discovery and events.
4. **Learn (`/learn`)**: The unified educational hub.
5. **Profile (`/profile`)**: The user's personal identity, stats, and preferences.

### Level 2 & 3: Capability Drill-downs

#### 1. Home & Social Updates
- `/home` - Main dashboard (replaces root `ai-conversation` redirect).
- `/home/moments` - Social feed (previously `/moments`).
- `/home/notifications` - Notifications and updates (previously `/notifications`).

#### 2. Communication Hub (Chat & Calls)
- `/chat` - Chat list and primary messaging entry.
- `/chat/room/:id` - Specific conversation.
- `/chat/calls` - Unified call history (previously `/call-logs`).
- `/chat/active` - Ongoing call view (previously `/active-call`).
- `/chat/groups` - Group chat management and join links (previously `/groups`, `/join`).

#### 3. Discovery (People, Rooms & Events)
- `/discover` - Replaces `/discovery` and `/community` as the main entry point.
- `/discover/people` - Partner search and study buddy matching (previously `/study-buddy`).
- `/discover/rooms` - Live audio/video rooms (consolidates `/audio-rooms`, `/classrooms`).
- `/discover/events` - Calendar and language parties (consolidates `/events`, `/events/calendar`).
- `/discover/leaderboard` - Community rankings (previously `/leaderboard`).

#### 4. Learning Centre
- `/learn` - Main educational dashboard.
- `/learn/lessons` - Core curriculum (previously `/lessons`).
- `/learn/ai` - AI Conversation (previously `/ai-conversation`).
- `/learn/flashcards` - Consolidated vocabulary, decks, and review (consolidates `/vocabulary`, `/decks`, `/review`).
- `/learn/assessments` - Quizzes and level checks (consolidates `/diagnostic-quiz`, `/proficiency`).
- `/learn/resources` - Reading engine and library (consolidates `/read`, `/resource-library`).

#### 5. Profile & Identity
- `/profile/me` - The authenticated user's profile.
- `/profile/user/:id` - Another user's profile.
- `/profile/stats` - Personal milestones and study streaks (consolidates `/stats`, `/milestones`, `/study-streak`).
- `/profile/network` - Followers and visitors (consolidates `/profile/:userId/followers/following`, `/profile/visitors`).
- `/profile/business` - Business profile settings.

#### 6. Wallet & Commerce (Accessed via Profile or Header)
- `/wallet` - Unified economy dashboard (previously `/coin-economy`).
- `/wallet/subscription` - Premium management (consolidates `/subscription`, `/settings/subscription`).
- `/wallet/store` - Shop and stickers (consolidates `/shop`, `/sticker-store`).
- `/wallet/escrow` - Escrow payments.

#### 7. Settings (Strictly nested)
- All settings securely nested under `/settings` without top-level aliases.
- `/settings/account`
- `/settings/privacy` (consolidates `/settings/blocks`, `/settings/gdpr`)
- `/settings/preferences` (consolidates `/settings/language`, `/settings/notification`, `/settings/appearance`)
- `/settings/system` (consolidates `/settings/data-storage`, `/settings/backup-restore`, `/settings/version`)

#### 8. Auth & Admin (Isolated)
- Remain separate at `/auth` (or `/login`, `/register`, etc.) and `/admin`.
