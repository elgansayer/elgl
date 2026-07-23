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

export const routes: Routes = [
  { path: '', redirectTo: 'discovery', pathMatch: 'full' },
  { path: 'discovery', component: DiscoveryComponent },
  { path: 'moments', component: MomentsFeedComponent },
  { path: 'audio-rooms', component: AudioRoomComponent },
  { path: 'chat', component: ChatListComponent },
  { path: 'chat/:id', component: ChatRoomComponent },
  { path: 'favourites', component: FavouritesComponent },
  { path: 'vocabulary', component: VocabularyDashboardComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'visitors', component: VisitorLogsComponent },
  { path: 'profile/visitors', component: ProfileVisitorsComponent },
  { path: 'developer', component: DeveloperDashboardComponent },
  {
    path: 'hobby-tags',
    loadComponent: () =>
      import('./components/hobby-tags/hobby-tags.component').then(
        (m) => m.HobbyTagsComponent
      ),
  },
];
