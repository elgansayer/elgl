import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, effect, viewChild, ElementRef } from '@angular/core';
import { VideoTrack } from 'livekit-client';
import { TranslatePipe } from '../../services/translate.pipe';
import { LiveChatOverlayComponent } from '../live-chat-overlay/live-chat-overlay.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { VideoClassroomOnboardingService } from '../../services/video-classroom-onboarding.service';

@Component({
  selector: 'app-video-room',
  imports: [HlmButton, TranslatePipe, LiveChatOverlayComponent, AppSkeletonLoaderComponent],
  template: `
    @if (store.currentRoom(); as room) {
      <section
        class="flex flex-col h-full w-full bg-surface-900 p-3 sm:p-4 rounded-2xl"
        aria-label="{{ 'videoRoom.hostVideoAria' | t }}"
        role="region"
      >
        <!-- Room Header -->
        <div
          class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4 text-white"
        >
          <h2 class="text-lg sm:text-xl font-bold line-clamp-2">{{ room.title }}</h2>

          <div class="flex items-center gap-2">
            @if (isHost() && !hasCoHost()) {
              @if (eligibleSpeakers().length > 0) {
                <span>
                  <button
                    hlmBtn
                    (click)="showInvitePicker.set(!showInvitePicker())"
                    [attr.aria-label]="'videoRoom.inviteCoHostAria' | t"
                    [attr.aria-expanded]="showInvitePicker()"
                    [attr.aria-haspopup]="'listbox'"
                    class="bg-primary hover:bg-primary/80 text-on-fill px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap self-start sm:self-auto"
                  >
                    {{ 'audioRoom.inviteCoHostBtn' | t }}
                  </button>
                </span>
              } @else {
                <p class="app-muted text-xs" role="status">
                  {{ 'videoRoom.noEligibleSpeakers' | t }}
                </p>
              }
            }
            <button
              hlmBtn
              type="button"
              (click)="startOnboardingTour()"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors text-sm font-bold"
              [attr.aria-label]="'videoClassroomTour.helpBtn' | t"
            >
              ?
            </button>
          </div>
        </div>

        @if (showInvitePicker()) {
          <div
            class="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2"
            role="listbox"
            [attr.aria-label]="'videoRoom.speakerPickerAria' | t"
          >
            @for (speakerId of eligibleSpeakers(); track speakerId) {
              <button
                hlmBtn
                (click)="selectCoHost(speakerId)"
                role="option"
                [attr.aria-selected]="false"
                [attr.aria-label]="'videoRoom.speakerOptionAria' | t: { id: speakerId.slice(0, 6) }"
                [attr.aria-setsize]="eligibleSpeakers().length"
                class="bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white"
              >
                {{ 'audioRoom.speakerPrefix' | t: { id: speakerId.slice(0, 6) } }}
              </button>
            }
          </div>
        }

        <!-- Dynamic Video Grid -->
        <div
          class="flex-1 grid gap-3 sm:gap-4 transition-all duration-300"
          [class]="gridClass()"
          role="group"
          aria-label="{{ 'videoRoom.hostVideoAria' | t }}"
        >
          <!-- Host Video Tile -->
          <div
            class="relative bg-black rounded-xl overflow-hidden border-2 border-white/10 flex items-center justify-center shadow-lg min-h-0"
            role="region"
            [attr.aria-label]="'videoRoom.hostBadge' | t"
          >
            @if (!hasHostVideo()) {
              <div
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6"
              >
                <app-skeleton-loader [height]="'48px'" [width]="'48px'" [variant]="'circle'" />
                <app-skeleton-loader [height]="'12px'" [width]="'50%'" [variant]="'text'" />
                <p class="text-white/60 text-xs sm:text-sm" aria-live="polite">
                  {{ 'videoRoom.waitingForHost' | t }}
                </p>
              </div>
            }
            <video
              #hostVideo
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
              [attr.aria-label]="'videoRoom.hostVideoAria' | t"
            ></video>
            <div
              class="absolute bottom-3 sm:bottom-4 start-3 sm:start-4 bg-black/60 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-white text-xs sm:text-sm backdrop-blur-sm"
              role="status"
            >
              {{ 'videoRoom.hostBadge' | t }}
            </div>

            <!-- Scrolling live chat overlay over host video stream -->
            <app-live-chat-overlay [roomId]="room.id"></app-live-chat-overlay>
          </div>

          <!-- Co-Host Video Tile (Split Screen) -->
          @if (hasCoHost()) {
            <div
              class="relative bg-black rounded-xl overflow-hidden border-2 border-secondary flex items-center justify-center shadow-lg animate-fade-in min-h-0"
              role="region"
              [attr.aria-label]="'videoRoom.coHostBadge' | t"
            >
              @if (!hasCoHostVideo()) {
                <div
                  class="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-2 p-3 sm:p-4"
                >
                  <app-skeleton-loader [height]="'48px'" [width]="'48px'" [variant]="'circle'" />
                  <app-skeleton-loader [height]="'12px'" [width]="'50%'" [variant]="'text'" />
                  <p class="text-white/60 text-xs sm:text-sm" aria-live="polite">
                    {{ 'videoRoom.waitingForCoHost' | t }}
                  </p>
                </div>
              }
              <video
                #coHostVideo
                autoplay
                playsinline
                class="w-full h-full object-cover"
                [attr.aria-label]="'videoRoom.coHostVideoAria' | t"
              ></video>
              <div
                class="absolute bottom-3 sm:bottom-4 start-3 sm:start-4 bg-black/60 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-white text-xs sm:text-sm backdrop-blur-sm"
                role="status"
              >
                {{ 'videoRoom.coHostBadge' | t }}
              </div>

              @if (isHost()) {
                <button
                  hlmBtn
                  (click)="removeCoHost()"
                  [attr.aria-label]="'videoRoom.removeCoHostAria' | t"
                  class="absolute top-3 sm:top-4 end-3 sm:end-4 bg-danger/80 hover:bg-danger text-on-fill p-1.5 sm:p-2 rounded-full backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 sm:h-5 sm:w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              }
            </div>
          }
        </div>
      </section>
    } @else {
      <div
        class="flex flex-col items-center justify-center h-full w-full bg-surface-900 rounded-2xl p-8 gap-4"
      >
        <app-skeleton-loader [height]="'80px'" [width]="'80px'" [variant]="'circle'" />
        <app-skeleton-loader [height]="'20px'" [width]="'60%'" [variant]="'text'" />
        <app-skeleton-loader [height]="'14px'" [width]="'40%'" [variant]="'text'" />
        <p class="text-white/60 text-sm mt-2">{{ 'videoRoom.connectingToRoom' | t }}</p>
      </div>
    }
  `,
  styles: [
    `
      .animate-fade-in {
        animation: fadeIn 0.3s ease-out forwards;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
  ],
})
export class VideoRoomComponent {
  readonly store = inject(AudioRoomsStore);
  private readonly authService = inject(AuthService);
  private readonly onboardingService = inject(VideoClassroomOnboardingService);

  readonly showInvitePicker = signal(false);

  readonly hostVideoRef = viewChild<ElementRef<HTMLVideoElement>>('hostVideo');
  readonly coHostVideoRef = viewChild<ElementRef<HTMLVideoElement>>('coHostVideo');

  readonly hostVideoTrack = this.store.hostVideoTrack;
  readonly coHostVideoTrack = this.store.coHostVideoTrack;

  readonly isHost = computed(
    () => this.authService.currentUser()?.id === this.store.currentRoom()?.host_id,
  );
  readonly hasCoHost = computed(() => !!this.store.currentRoom()?.co_host_id);

  readonly isCoHost = computed(
    () => this.authService.currentUser()?.id === this.store.currentRoom()?.co_host_id,
  );

  readonly eligibleSpeakers = computed(() => {
    const room = this.store.currentRoom();
    if (!room) return [];
    return room.speakers.filter((id) => id !== room.host_id && id !== room.co_host_id);
  });

  // Dynamically switch between single view and split-screen
  readonly gridClass = computed(() => {
    return this.hasCoHost() ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-4xl mx-auto w-full';
  });

  /**
   * Host video track that falls back to the local camera track when the current
   * user IS the host (so they can see their own video in the split-screen layout).
   */
  readonly hostVideoTrackOrDefault = computed<VideoTrack | null>(() => {
    if (this.isHost()) {
      const localTrack = this.store.localVideoTrack();
      if (localTrack) return localTrack;
    }
    return this.store.hostVideoTrack();
  });

  readonly hasHostVideo = computed(() => !!this.hostVideoTrackOrDefault());

  /**
   * Co-host video track that falls back to the local camera track when the current
   * user IS the co-host (so they can see their own video in the split-screen layout).
   */
  readonly coHostVideoTrackOrDefault = computed<VideoTrack | null>(() => {
    if (this.isCoHost()) {
      const localTrack = this.store.localVideoTrack();
      if (localTrack) return localTrack;
    }
    return this.store.coHostVideoTrack();
  });

  readonly hasCoHostVideo = computed(() => !!this.coHostVideoTrackOrDefault());

  constructor() {
    effect(() => {
      const track = this.hostVideoTrackOrDefault();
      const videoEl = this.hostVideoRef()?.nativeElement;
      this.attach(track, videoEl);
    });

    effect(() => {
      const track = this.coHostVideoTrackOrDefault();
      const videoEl = this.coHostVideoRef()?.nativeElement;
      this.attach(track, videoEl);
    });
  }

  private attach(track: VideoTrack | null, videoEl: HTMLVideoElement | undefined): void {
    if (track && videoEl) {
      track.attach(videoEl);
    }
  }

  selectCoHost(targetUserId: string): void {
    this.showInvitePicker.set(false);
    void this.store.inviteCoHost(targetUserId);
  }

  removeCoHost(): void {
    void this.store.removeCoHost();
  }

  /** Start the video classroom room-level onboarding tour using ngx-joyride. */
  startOnboardingTour(): void {
    this.onboardingService.startRoomTour();
  }
}
