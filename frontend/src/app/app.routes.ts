import { Routes } from '@angular/router';
import { DiscoveryComponent } from './components/discovery/discovery.component';
import { ProfileComponent } from './components/profile/profile.component';
import { VisitorLogsComponent } from './components/visitor-logs/visitor-logs.component';
import { ChatRoomComponent } from './components/chat-room/chat-room.component';
import { ChatListComponent } from './components/chat-list/chat-list.component';
import { FavouritesComponent } from './components/favourites/favourites.component';
import { VocabularyDashboardComponent } from './components/vocabulary-dashboard/vocabulary-dashboard.component';
import { MomentsFeedComponent } from './components/moments-feed/moments-feed.component';
import { AudioRoomComponent } from './components/audio-room/audio-room.component';
import { DeveloperDashboardComponent } from './components/developer-dashboard/developer-dashboard.component';
import { ProfileVisitorsComponent } from './components/profile-visitors/profile-visitors.component';
import { VideoCallComponent } from './components/video-call/video-call.component';
import { UserDetailComponent } from './components/user-detail/user-detail.component';
import { SubscriptionSuccessComponent } from './components/subscription-success/subscription-success.component';
import { SubscriptionCancelComponent } from './components/subscription-cancel/subscription-cancel.component';

import { NotificationsInboxComponent } from './components/notifications-inbox/notifications-inbox.component';

export const routes: Routes = [
  { path: '', redirectTo: 'discovery', pathMatch: 'full' },
  { path: 'discovery', component: DiscoveryComponent },
  { path: 'moments', component: MomentsFeedComponent },
  { path: 'notifications', component: NotificationsInboxComponent },
  { path: 'audio-rooms', component: AudioRoomComponent },
  { path: 'chat', component: ChatListComponent },
  { path: 'chat/:id', component: ChatRoomComponent },
  { path: 'leaderboard', loadComponent: () => import('./components/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent) },
  { path: 'favourites', component: FavouritesComponent },
  { path: 'vocabulary', component: VocabularyDashboardComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'profile/user/:id', component: UserDetailComponent },
  { path: 'visitors', component: VisitorLogsComponent },
  { path: 'profile/visitors', component: ProfileVisitorsComponent },
  { path: 'settings', loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'developer', component: DeveloperDashboardComponent },
  { path: 'video-call', component: VideoCallComponent },
  {
    path: 'hobby-tags',
    loadComponent: () =>
      import('./components/hobby-tags/hobby-tags.component').then(
        (m) => m.HobbyTagsComponent
      ),
  },
  {
    path: 'vip',
    loadComponent: () =>
      import('./pages/vip-subscription/vip-subscription.component').then(
        (m) => m.VipSubscriptionComponent
      ),
    title: 'VIP Subscription - HelloTalk',
  },
  {
    path: 'subscription',
    loadComponent: () =>
      import('./pages/subscription/subscription-page.component').then(
        (m) => m.SubscriptionPageComponent
      ),
    title: 'Subscription Plans - HelloTalk',
  },
  {
    path: 'subscription/success',
    component: SubscriptionSuccessComponent,
    title: 'Subscription Successful - HelloTalk',
  },
  {
    path: 'subscription/cancel',
    component: SubscriptionCancelComponent,
    title: 'Subscription Cancelled - HelloTalk',
  },
];
