import { Routes } from '@angular/router';
import { DiscoveryComponent } from './components/discovery/discovery.component';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Home - HelloTalk',
  },
  { path: 'discovery', component: DiscoveryComponent },
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
    path: 'audio-rooms',
    loadComponent: () =>
      import('./components/audio-room/audio-room.component').then((m) => m.AudioRoomComponent),
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
    path: 'vocabulary',
    loadComponent: () =>
      import('./components/vocabulary-dashboard/vocabulary-dashboard.component').then(
        (m) => m.VocabularyDashboardComponent,
      ),
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
    path: 'visitors',
    loadComponent: () =>
      import('./components/visitor-logs/visitor-logs.component').then(
        (m) => m.VisitorLogsComponent,
      ),
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
    loadComponent: () =>
      import('./pages/vip/vip.component').then(
        (m) => m.VipComponent,
      ),
    title: 'VIP Subscription - HelloTalk',
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
    loadComponent: () =>
      import('./pages/help-centre/help-centre.component').then((m) => m.HelpCentreComponent),
    title: 'Help Centre - HelloTalk',
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./components/onboarding/onboarding-wizard.component').then((m) => m.OnboardingWizardComponent),
    title: 'Onboarding - HelloTalk',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./components/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    title: 'Forgot Password - HelloTalk',
  },
  {
    path: 'host-dashboard',
    loadComponent: () =>
      import('./components/host-dashboard/host-dashboard.component').then((m) => m.HostDashboardComponent),
    title: 'Host Dashboard - HelloTalk',
  },
];
