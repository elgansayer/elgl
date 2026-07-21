import { Routes } from '@angular/router';
import { DiscoveryComponent } from './components/discovery/discovery.component';
import { ProfileComponent } from './components/profile/profile.component';
import { VisitorLogsComponent } from './components/visitor-logs/visitor-logs.component';
import { ChatRoomComponent } from './components/chat-room/chat-room.component';
import { FavouritesComponent } from './components/favourites/favourites.component';
import { VocabularyDashboardComponent } from './components/vocabulary-dashboard/vocabulary-dashboard.component';
import { MomentsFeedComponent } from './components/moments-feed/moments-feed.component';
import { AudioRoomComponent } from './components/audio-room/audio-room.component';
import { DeveloperDashboardComponent } from './components/developer-dashboard/developer-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'discovery', pathMatch: 'full' },
  { path: 'discovery', component: DiscoveryComponent },
  { path: 'moments', component: MomentsFeedComponent },
  { path: 'audio-rooms', component: AudioRoomComponent },
  { path: 'chat', component: ChatRoomComponent },
  { path: 'chat/:id', component: ChatRoomComponent },
  { path: 'favourites', component: FavouritesComponent },
  { path: 'vocabulary', component: VocabularyDashboardComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'visitors', component: VisitorLogsComponent },
  { path: 'developer', component: DeveloperDashboardComponent },
];
