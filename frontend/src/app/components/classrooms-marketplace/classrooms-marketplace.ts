<<<<<<< HEAD
import { Component, inject } from '@angular/core';
import { JoyrideModule } from 'ngx-joyride';
import { TranslatePipe } from '../../services/translate.pipe';
import { TourService } from '../../services/tour.service';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';

@Component({
  selector: 'app-classrooms-marketplace',
  imports: [TranslatePipe, JoyrideModule],
  template: `
    <div
      class="p-4"
      joyrideStep="videoClassroomTour@marketplace"
      [text]="'videoClassroomTour.marketplaceDesc' | t"
      stepPosition="bottom"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-2xl font-bold text-white">{{ 'videoClassroomTour.marketplaceTitle' | t }}</h2>
        <button
          (click)="startOnboardingTour()"
          class="rounded-app bg-indigo-600 hover:bg-indigo-700 ps-4 pe-4 pt-2 pb-2 text-xs font-bold text-white transition-colors"
        >
          {{ 'escrow.onboarding.helpBtn' | t }}
        </button>
      </div>

      @if (activeVideoRooms().length === 0) {
        <div class="text-center py-10 opacity-70">
          <p class="text-lg font-semibold text-text-secondary">{{ 'audioRoom.noActiveRooms' | t }}</p>
          <p class="text-sm mt-1">{{ 'audioRoom.beFirst' | t }}</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          @for (room of activeVideoRooms(); track room.id) {
            @if (room.is_video_stream && room.is_active) {
              <article class="app-card app-padded space-y-3">
                <div class="flex items-center justify-between">
                  <span class="app-chip bg-red-500/20 text-red-400">{{ 'audioRoom.liveTag' | t }}</span>
                  <span class="app-chip text-primary">{{ room.language_pair || room.target_language }}</span>
                </div>
                <h3 class="text-base font-black text-text-primary">{{ room.title }}</h3>
                <p class="text-xs text-text-secondary">
                  {{ 'audioRoom.hostLabel' | t }}:
                  <span class="font-semibold text-text-primary">{{ room.host?.display_name || ('audioRoom.hostFallback' | t) }}</span>
                </p>
                <div class="flex items-center justify-between border-t border-surface-100 pt-3">
                  <span class="app-muted">{{ 'audioRoom.listenersCount' | t: { count: room.listeners_count } }}</span>
                  <button (click)="joinRoom(room)" class="app-button-primary ps-4 pe-4 pt-2 pb-2 text-xs">
                    {{ 'audioRoom.joinRoomBtn' | t }}
                  </button>
                </div>
              </article>
            }
          }
        </div>
      }
    </div>
  `,
})
export class ClassroomsMarketplace {
  private readonly tourService = inject(TourService);
  readonly store = inject(AudioRoomsStore);

  readonly activeVideoRooms = this.store.activeRooms;

  startOnboardingTour(): void {
    this.tourService.resetVideoClassroomTour();
    this.tourService.startVideoClassroomTour();
  }

  joinRoom(room: AudioRoomRecord): void {
    void this.store.joinRoom(room);
=======
import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { VideoClassroomErrorHandlerService } from '../../services/video-classroom-error-handler.service';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { TranslatePipe } from '../../services/translate.pipe';
import { VideoClassroomErrorBoundaryComponent } from '../video-classroom-error-boundary/video-classroom-error-boundary.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { firstValueFrom, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-classrooms-marketplace',
  imports: [SanitiseHtmlPipe, TranslatePipe, VideoClassroomErrorBoundaryComponent, AppSkeletonLoaderComponent, AppEmptyStateComponent],
  templateUrl: './classrooms-marketplace.html',
  styles: [''],
})
export class ClassroomsMarketplace implements OnInit {
  private store = inject(AudioRoomsStore);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private errorHandler = inject(VideoClassroomErrorHandlerService);
  private destroyRef = inject(DestroyRef);
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

  readonly videoRooms = computed(() =>
    this.filteredRooms().filter((r) => r.is_video_stream),
  );

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
      const list = await firstValueFrom(
        this.http.get<AudioRoomRecord[]>(
          `${this.baseUrl}/list`,
          { headers: this.getHeaders() },
        ),
      );
      this.rooms.set(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.errorMessage.set(error.message);
      this.errorHandler.reportVideoClassroomCrash(error, {
        action: 'loadClassrooms',
      });
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
>>>>>>> origin/main
  }
}
