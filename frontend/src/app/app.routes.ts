import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'ai-conversation', pathMatch: 'full' },
  {
    path: 'lock',
    loadComponent: () =>
      import('./components/device-lock/device-lock.component').then((m) => m.DeviceLockComponent),
    title: 'App Lock - HelloTalk',
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Home - HelloTalk',
  },
  {
    path: 'business-profile',
    loadComponent: () =>
      import('./components/business-profile/business-profile.component').then(
        (m) => m.BusinessProfileComponent,
      ),
    title: 'Business Profile - HelloTalk',
  },
  {
    path: 'discovery',
    loadComponent: () =>
      import('./components/discovery/discovery.component').then((m) => m.DiscoveryComponent),
  },
  {
    path: 'proficiency',
    loadComponent: () =>
      import('./components/proficiency-assessment/proficiency-assessment.component').then(
        (m) => m.ProficiencyAssessmentComponent,
      ),
    title: 'Proficiency Assessment - HelloTalk',
  },
  {
    path: 'moments',
    loadComponent: () =>
      import('./components/moments-feed/moments-feed.component').then(
        (m) => m.MomentsFeedComponent,
      ),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./components/notifications-inbox/notifications-inbox.component').then(
        (m) => m.NotificationsInboxComponent,
      ),
  },
  {
    path: 'notification-preferences',
    redirectTo: 'settings/notification',
    pathMatch: 'full',
  },
  {
    path: 'audio-rooms',
    loadComponent: () =>
      import('./components/audio-room/audio-room.component').then((m) => m.AudioRoomComponent),
  },
  {
    path: 'classrooms',
    loadComponent: () =>
      import('./components/classrooms-marketplace/classrooms-marketplace').then(
        (m) => m.ClassroomsMarketplace,
      ),
    title: 'Video Classrooms - HelloTalk',
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./components/chat-list/chat-list.component').then((m) => m.ChatListComponent),
  },
  {
    path: 'chat/:id',
    loadComponent: () =>
      import('./components/chat-room/chat-room.component').then((m) => m.ChatRoomComponent),
  },
  {
    path: 'groups',
    redirectTo: 'community/groups',
    pathMatch: 'full',
  },
  {
    path: 'groups/create',
    redirectTo: 'community/groups/create',
    pathMatch: 'full',
  },
  {
    path: 'communities',
    redirectTo: 'community',
    pathMatch: 'full',
  },
  {
    path: 'community',
    loadComponent: () =>
      import('./components/communities/communities.component').then((m) => m.CommunitiesComponent),
    title: 'Communities - HelloTalk',
  },
  {
    path: 'community/groups',
    loadComponent: () =>
      import('./components/groups-discovery/groups-discovery.component').then(
        (m) => m.GroupsDiscoveryComponent,
      ),
    title: 'Groups Discovery - HelloTalk',
  },
  {
    path: 'community/groups/create',
    loadComponent: () =>
      import('./components/create-group/create-group.component').then(
        (m) => m.CreateGroupComponent,
      ),
    title: 'Create Group - HelloTalk',
  },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./components/leaderboard/leaderboard.component').then((m) => m.LeaderboardComponent),
  },
  {
    path: 'favourites',
    loadComponent: () =>
      import('./components/favourites/favourites.component').then((m) => m.FavouritesComponent),
  },
  {
    path: 'suggest-flashcards',
    loadComponent: () =>
      import('./components/suggest-flashcards/suggest-flashcards.component').then(
        (m) => m.SuggestFlashcardsComponent,
      ),
    title: 'Suggest Flashcards - HelloTalk',
  },
  {
    path: 'suggest-flashcards/:message',
    loadComponent: () =>
      import('./components/suggest-flashcards/suggest-flashcards.component').then(
        (m) => m.SuggestFlashcardsComponent,
      ),
    title: 'Suggest Flashcards - HelloTalk',
  },
  {
    path: 'vocabulary',
    loadComponent: () =>
      import('./components/vocabulary-dashboard/vocabulary-dashboard.component').then(
        (m) => m.VocabularyDashboardComponent,
      ),
  },
  {
    path: 'decks',
    loadComponent: () =>
      import('./components/flashcard-deck/flashcard-deck.component').then(
        (m) => m.FlashcardDeckComponent,
      ),
    title: 'Flashcard Decks - HelloTalk',
  },
  {
    path: 'review',
    loadComponent: () =>
      import('./components/flashcard-review/flashcard-review.component').then(
        (m) => m.FlashcardReviewComponent,
      ),
    title: 'Flashcard Review - HelloTalk',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'profile/:userId',
    loadComponent: () =>
      import('./components/user-detail/user-detail.component').then((m) => m.UserDetailComponent),
  },
  {
    path: 'profile/:userId/followers',
    loadComponent: () =>
      import('./components/follow-list/follow-list.component').then((m) => m.FollowListComponent),
    data: { mode: 'followers' },
    title: 'Followers - HelloTalk',
  },
  {
    path: 'profile/:userId/following',
    loadComponent: () =>
      import('./components/follow-list/follow-list.component').then((m) => m.FollowListComponent),
    data: { mode: 'following' },
    title: 'Following - HelloTalk',
  },
  {
    path: 'visitors',
    redirectTo: 'profile/visitors',
    pathMatch: 'full',
  },
  {
    path: 'profile/visitors',
    loadComponent: () =>
      import('./components/profile-visitors/profile-visitors.component').then(
        (m) => m.ProfileVisitorsComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'settings/account',
    loadComponent: () =>
      import('./pages/settings/account/account.component').then((m) => m.AccountSettingsComponent),
    title: 'Account Settings - HelloTalk',
  },
  {
    path: 'settings/notification',
    loadComponent: () =>
      import('./pages/settings/notification-settings/notification-settings.component').then(
        (m) => m.NotificationSettingsComponent,
      ),
    title: 'Notification Settings - HelloTalk',
  },
  {
    path: 'settings/notification-customization',
    redirectTo: 'settings/notification',
    pathMatch: 'full',
  },
  {
    path: 'settings/message-filters',
    loadComponent: () =>
      import('./pages/settings/message-filter-settings/message-filter-settings.component').then(
        (m) => m.MessageFilterSettingsComponent,
      ),
    title: 'Message Filters - HelloTalk',
  },
  {
    path: 'settings/appearance',
    loadComponent: () =>
      import('./pages/settings/appearance-settings/appearance-settings.component').then(
        (m) => m.AppearanceSettingsComponent,
      ),
    title: 'Appearance - HelloTalk',
  },
  {
    path: 'settings/privacy',
    loadComponent: () =>
      import('./pages/settings/privacy-settings/privacy-settings.component').then(
        (m) => m.PrivacySettingsComponent,
      ),
    title: 'Privacy Settings - HelloTalk',
  },
  {
    path: 'settings/backup-restore',
    loadComponent: () =>
      import('./pages/settings/backup-restore.component').then((m) => m.BackupRestoreComponent),
    title: 'Chat Backup & Restore - HelloTalk',
  },
  {
    path: 'settings/linked-accounts',
    loadComponent: () =>
      import('./pages/settings/linked-accounts/linked-accounts.component').then(
        (m) => m.LinkedAccountsComponent,
      ),
    title: 'Linked Accounts - HelloTalk',
  },
  {
    path: 'developer',
    loadComponent: () =>
      import('./components/developer-dashboard/developer-dashboard.component').then(
        (m) => m.DeveloperDashboardComponent,
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./components/admin-portal/admin-portal.component').then(
        (m) => m.AdminPortalComponent,
      ),
    canActivate: [adminGuard],
    title: 'Admin Portal - HelloTalk',
  },
  {
    path: 'admin/lessons',
    loadComponent: () =>
      import('./components/lesson-manager/lesson-manager.component').then(
        (m) => m.LessonManagerComponent,
      ),
    canActivate: [adminGuard],
    title: 'Lesson Management - HelloTalk',
  },
  {
    path: 'video-call',
    loadComponent: () =>
      import('./components/video-call/video-call.component').then((m) => m.VideoCallComponent),
  },
  {
    path: 'stats',
    loadComponent: () =>
      import('./components/my-stats/my-stats.component').then((m) => m.MyStatsComponent),
  },
  {
    path: 'hobby-tags',
    loadComponent: () =>
      import('./components/hobby-tags/hobby-tags.component').then((m) => m.HobbyTagsComponent),
  },
  {
    path: 'vip',
    redirectTo: 'subscription',
    pathMatch: 'full',
  },
  {
    path: 'subscription',
    loadComponent: () =>
      import('./pages/subscription/subscription-page.component').then(
        (m) => m.SubscriptionPageComponent,
      ),
    title: 'Subscription Plans - HelloTalk',
  },
  {
    path: 'subscription/success',
    loadComponent: () =>
      import('./components/subscription-success/subscription-success.component').then(
        (m) => m.SubscriptionSuccessComponent,
      ),
    title: 'Subscription Successful - HelloTalk',
  },
  {
    path: 'subscription/cancel',
    loadComponent: () =>
      import('./components/subscription-cancel/subscription-cancel.component').then(
        (m) => m.SubscriptionCancelComponent,
      ),
    title: 'Subscription Cancelled - HelloTalk',
  },
  {
    path: 'coins/success',
    loadComponent: () =>
      import('./components/coins-success/coins-success.component').then(
        (m) => m.CoinsSuccessComponent,
      ),
    title: 'Coin Purchase - HelloTalk',
  },
  {
    path: 'coins/cancel',
    loadComponent: () =>
      import('./components/coins-cancel/coins-cancel.component').then(
        (m) => m.CoinsCancelComponent,
      ),
    title: 'Coin Purchase Cancelled - HelloTalk',
  },
  {
    path: 'preview/room/:id',
    loadComponent: () =>
      import('./pages/voiceroom-preview/voiceroom-preview.component').then(
        (m) => m.VoiceroomPreviewComponent,
      ),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/legal/terms.component').then((m) => m.TermsComponent),
    title: 'Terms of Service - HelloTalk',
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/legal/privacy.component').then((m) => m.PrivacyComponent),
    title: 'Privacy Policy - HelloTalk',
  },
  {
    path: 'help',
    redirectTo: 'support',
    pathMatch: 'full',
  },
  {
    path: 'support',
    loadComponent: () =>
      import('./pages/support-centre/support-centre.component').then(
        (m) => m.SupportCentreComponent,
      ),
    title: 'Support Centre - HelloTalk',
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./components/onboarding/onboarding-wizard.component').then(
        (m) => m.OnboardingWizardComponent,
      ),
    title: 'Onboarding - HelloTalk',
  },
  {
    path: 'diagnostic-quiz',
    loadComponent: () =>
      import('./components/diagnostic-quiz/diagnostic-quiz.component').then(
        (m) => m.DiagnosticQuizComponent,
      ),
    title: 'Language Level Diagnostic - HelloTalk',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./components/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
    title: 'Forgot Password - HelloTalk',
  },
  {
    path: 'host-dashboard',
    loadComponent: () =>
      import('./components/host-dashboard/host-dashboard.component').then(
        (m) => m.HostDashboardComponent,
      ),
    title: 'Host Dashboard - HelloTalk',
  },
  {
    path: 'language',
    redirectTo: 'settings/language',
    pathMatch: 'full',
  },
  {
    path: 'settings/language',
    loadComponent: () =>
      import('./pages/language-settings/language-settings.component').then(
        (m) => m.LanguageSettingsComponent,
      ),
    title: 'Language Settings - HelloTalk',
  },
  {
    path: 'blocks',
    redirectTo: 'settings/blocks',
    pathMatch: 'full',
  },
  {
    path: 'settings/blocks',
    loadComponent: () =>
      import('./pages/block-management/block-management.component').then(
        (m) => m.BlockManagementComponent,
      ),
    title: 'Block Management - HelloTalk',
  },
  {
    path: 'message-filters',
    redirectTo: 'settings/message-filters',
    pathMatch: 'full',
  },
  {
    path: 'chat-settings',
    redirectTo: 'settings/chat',
    pathMatch: 'full',
  },
  {
    path: 'settings/chat',
    loadComponent: () =>
      import('./pages/chat-settings/chat-settings.component').then((m) => m.ChatSettingsComponent),
    title: 'Chat Settings - HelloTalk',
  },
  {
    path: 'data-storage',
    redirectTo: 'settings/data-storage',
    pathMatch: 'full',
  },
  {
    path: 'settings/data-storage',
    loadComponent: () =>
      import('./pages/data-storage/data-storage.component').then((m) => m.DataStorageComponent),
    title: 'Data & Storage - HelloTalk',
  },
  {
    path: 'shop',
    loadComponent: () => import('./components/shop/shop.component').then((m) => m.ShopComponent),
    title: 'Shop - HelloTalk',
  },
  {
    path: 'sticker-store',
    loadComponent: () =>
      import('./components/sticker-store/sticker-store.component').then(
        (m) => m.StickerStoreComponent,
      ),
    title: 'Sticker Store - HelloTalk',
  },
  {
    path: 'cart',
    loadComponent: () => import('./components/cart/cart.component').then((m) => m.CartComponent),
    title: 'Shopping Cart - HelloTalk',
  },
  {
    path: 'gdpr',
    loadComponent: () => import('./components/gdpr/gdpr.component').then((m) => m.GdprComponent),
    title: 'Personal Data - HelloTalk',
  },
  {
    path: 'help-about',
    redirectTo: 'support',
    pathMatch: 'full',
  },
  {
    path: 'ai-conversation',
    loadComponent: () =>
      import('./ai-conversation/ai-conversation.component').then((m) => m.AiConversationComponent),
    title: 'AI Conversation - HelloTalk',
  },
  {
    path: 'quests',
    loadComponent: () =>
      import('./components/quests/quests.component').then((m) => m.QuestsComponent),
    title: 'Quests - HelloTalk',
  },
  {
    path: 'lessons',
    loadComponent: () =>
      import('./pages/lessons/lessons.component').then((m) => m.LessonsComponent),
    title: 'Lessons - HelloTalk',
  },
  {
    path: 'voiceroom-notes/:roomId',
    loadComponent: () =>
      import('./components/voiceroom-notes/voiceroom-notes.component').then(
        (m) => m.VoiceroomNotesComponent,
      ),
    title: 'Voice Room Notes - HelloTalk',
  },
  {
    path: 'call-logs',
    loadComponent: () =>
      import('./pages/call-logs/call-logs.component').then((m) => m.CallLogsComponent),
    title: 'Call Logs - HelloTalk',
  },
  {
    path: 'active-call',
    loadComponent: () =>
      import('./components/active-call/active-call.component').then((m) => m.ActiveCallComponent),
    title: 'Active Call - HelloTalk',
  },
  {
    path: 'pronunciation-feedback',
    loadComponent: () =>
      import('./components/pronunciation-feedback/pronunciation-feedback.component').then(
        (m) => m.PronunciationFeedbackComponent,
      ),
    title: 'Pronunciation Feedback - HelloTalk',
  },
  {
    path: 'device-transfer',
    loadComponent: () =>
      import('./components/device-transfer/device-transfer.component').then(
        (m) => m.DeviceTransferComponent,
      ),
    title: 'Device Transfer - HelloTalk',
  },
  {
    path: 'admin/moderation',
    loadComponent: () =>
      import('./moderation/moderation-queue.component').then((m) => m.ModerationQueueComponent),
    canActivate: [adminGuard],
    title: 'Moderation - HelloTalk',
  },
  {
    path: 'admin/blocks',
    loadComponent: () =>
      import('./pages/admin/blocks/admin-blocks.component').then((m) => m.AdminBlocksComponent),
    canActivate: [adminGuard],
    title: 'Block Management - HelloTalk',
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./pages/admin/admin-users.component').then((m) => m.AdminUsersComponent),
    canActivate: [adminGuard],
    title: 'Admin Users - HelloTalk',
  },
  {
    path: 'milestones',
    loadComponent: () =>
      import('./components/milestone/milestone.component').then((m) => m.MilestoneComponent),
    title: 'Milestones - HelloTalk',
  },
  {
    path: 'study-buddy',
    loadComponent: () =>
      import('./components/study-buddy/study-buddy.component').then((m) => m.StudyBuddyComponent),
    title: 'Study Buddy Matching - HelloTalk',
  },
  {
    path: 'read',
    loadComponent: () =>
      import('./components/reading-engine/reading-engine.component').then(
        (m) => m.ReadingEngineComponent,
      ),
    title: 'LingQ Reading Engine - HelloTalk',
  },
  {
    path: 'resource-library',
    loadComponent: () =>
      import('./components/resource-library/resource-library.component').then(
        (m) => m.ResourceLibraryComponent,
      ),
    title: 'Resource Library - HelloTalk',
  },
  {
    path: 'study-streak',
    loadComponent: () =>
      import('./components/study-streak-counter/study-streak-counter.component').then(
        (m) => m.StudyStreakCounterComponent,
      ),
    title: 'Study Streak - HelloTalk',
  },
  {
    path: 'my-subscription',
    redirectTo: 'settings/subscription',
    pathMatch: 'full',
  },
  {
    path: 'settings/subscription',
    loadComponent: () =>
      import('./pages/my-subscription/my-subscription.component').then(
        (m) => m.MySubscriptionComponent,
      ),
    title: 'My Subscription - HelloTalk',
  },
  {
    path: 'escrow',
    loadComponent: () => import('./pages/escrow/escrow.component').then((m) => m.EscrowComponent),
    title: 'Escrow Payments - HelloTalk',
  },
  {
    path: 'escrow/:id',
    loadComponent: () =>
      import('./pages/escrow-detail/escrow-detail.component').then((m) => m.EscrowDetailComponent),
    title: 'Escrow Details - HelloTalk',
  },
  {
    path: 'account/deletion',
    loadComponent: () =>
      import('./components/account-deletion/account-deletion.component').then(
        (m) => m.AccountDeletionComponent,
      ),
    title: 'Account Deletion - HelloTalk',
  },
  {
    path: 'version',
    loadComponent: () =>
      import('./components/version-check/version-check.component').then(
        (m) => m.VersionCheckComponent,
      ),
    title: 'App Version - HelloTalk',
  },
  {
    path: 'language-islands',
    redirectTo: 'community/language-islands',
    pathMatch: 'full',
  },
  {
    path: 'language-parties',
    redirectTo: 'community/language-parties',
    pathMatch: 'full',
  },
  {
    path: 'community/language-islands',
    loadComponent: () =>
      import('./pages/language-islands/language-islands.component').then(
        (m) => m.LanguageIslandsComponent,
      ),
    title: 'Language Islands - HelloTalk',
  },
  {
    path: 'community/language-parties',
    loadComponent: () =>
      import('./components/language-parties/language-parties.component').then(
        (m) => m.LanguagePartiesComponent,
      ),
    title: 'Language Parties - HelloTalk',
  },
  {
    path: 'events',
    loadComponent: () =>
      import('./components/events-feed/events-feed.component').then((m) => m.EventsFeedComponent),
    title: 'Events - HelloTalk',
  },
  {
    path: 'events/calendar',
    loadComponent: () =>
      import('./components/events-calendar/events-calendar.component').then(
        (m) => m.EventsCalendarComponent,
      ),
    title: 'Event Calendar - HelloTalk',
  },
  {
    path: 'join',
    loadComponent: () =>
      import('./pages/join-group/join-group.component').then((m) => m.JoinGroupComponent),
    title: 'Join Group - HelloTalk',
  },
  {
    path: 'join/:code',
    loadComponent: () =>
      import('./pages/join-group/join-group.component').then((m) => m.JoinGroupComponent),
    title: 'Join Group - HelloTalk',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./components/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
    title: 'Reset Password - HelloTalk',
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./components/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
    title: 'Change Password - HelloTalk',
  },
  {
    path: 'coin-economy',
    loadComponent: () =>
      import('./components/coin-economy-dashboard/coin-economy-dashboard.component').then(
        (m) => m.CoinEconomyDashboardComponent,
      ),
    title: 'Virtual Coin Economy - HelloTalk',
  },
];
