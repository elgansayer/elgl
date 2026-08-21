import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { VideoClassroomErrorHandlerService } from '../../services/video-classroom-error-handler.service';
import { VideoClassroomOnboardingService } from '../../services/video-classroom-onboarding.service';
import { OfflineVideoClassroomService } from '../../services/offline-video-classroom.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { VideoClassroomErrorBoundaryComponent } from '../video-classroom-error-boundary/video-classroom-error-boundary.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { withRetry } from '../../services/http-retry';
import { firstValueFrom, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { JoyrideModule } from 'ngx-joyride';

@Component({
  selector: 'app-classrooms-marketplace',
  imports: [
    HlmButton,
    TranslatePipe,
    VideoClassroomErrorBoundaryComponent,
    AppSkeletonLoaderComponent,
    AppEmptyStateComponent,
    JoyrideModule,
  ],
  templateUrl: './classrooms-marketplace.html',
  styles: [''],
})
export class ClassroomsMarketplace implements OnInit {
  private store = inject(AudioRoomsStore);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private errorHandler = inject(VideoClassroomErrorHandlerService);
  private destroyRef = inject(DestroyRef);
  private onboardingService = inject(VideoClassroomOnboardingService);
  private offlineService = inject(OfflineVideoClassroomService);
  private baseUrl = `${environment.apiUrl}/audio-rooms`;

  readonly rooms = signal<AudioRoomRecord[]>([]);
  readonly isLoading = signal(true);
  readonly selectedLanguage = signal<string | null>(null);
  readonly errorMessage = signal<string>('');

  readonly languagePairOptions = computed(() => {
    const pairs = new Set<string>();
    for (const room of this.rooms()) {
      if (room.language_pair) {
        pairs.add(room.language_pair);
      }
    }
    return Array.from(pairs).sort();
  });

  readonly filteredRooms = computed(() => {
    const lang = this.selectedLanguage();
    const all = this.rooms();
    if (!lang) return all;
    return all.filter((r) => r.language_pair === lang);
  });

  readonly videoRooms = computed(() => this.filteredRooms().filter((r) => r.is_video_stream));

  readonly isHosting = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return false;
    return this.rooms().some((r) => r.host_id === userId);
  });

  // LiveKit integration requires imperative setup; exception permitted per AGENTS.md 5.3
  ngOnInit(): void {
    this.loadRooms();
    this.subscribeToUpdates();
  }

  async loadRooms(): Promise<void> {
    this.isLoading.set(true);
    try {
      const list = await withRetry(() =>
        firstValueFrom(
          this.http.get<AudioRoomRecord[]>(`${this.baseUrl}/list`, { headers: this.getHeaders() }),
        ),
      );
      const rooms = Array.isArray(list) ? list : [];
      this.rooms.set(rooms);
      // Cache successful fetch for offline use
      void this.offlineService.cacheClassroomListing(rooms);
    } catch (err: unknown) {
      // Attempt to serve cached data when offline or on fetch failure
      const cached = await this.offlineService.getCachedClassroomListing();
      if (cached && cached.length > 0) {
        this.rooms.set(cached);
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        this.errorMessage.set(error.message);
        this.errorHandler.reportVideoClassroomCrash(error, {
          action: 'loadClassrooms',
        });
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private subscribeToUpdates(): void {
    // Watch active rooms from the store for real-time updates
    interval(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const fresh = this.store.activeRooms();
        if (fresh.length > 0) {
          this.rooms.set(fresh);
        }
      });
  }

  selectLanguage(lang: string | null): void {
    this.selectedLanguage.set(lang);
  }

  async createClassroom(title: string, languagePair: string, topicTag: string): Promise<void> {
    await this.errorHandler.wrapClassroomCall(
      'createClassroom',
      async () => {
        const created = await this.store.createRoom(title, languagePair, topicTag, true);
        this.rooms.update((r) => [created, ...r]);
      },
      { roomName: title },
    );
  }

  async joinRoom(room: AudioRoomRecord): Promise<void> {
    await this.errorHandler.wrapClassroomCall(
      'joinRoom',
      async () => {
        await this.store.joinRoom(room);
      },
      { roomId: room.id, roomName: room.room_name },
    );
  }

  getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  /** Start the video classroom onboarding tour using ngx-joyride. */
  startOnboardingTour(): void {
    this.onboardingService.startMarketplaceTour();
  }
}
