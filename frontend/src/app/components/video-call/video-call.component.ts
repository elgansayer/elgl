import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  input,
  output,
  signal,
  effect,
  inject,
  viewChild,
  ElementRef,
} from '@angular/core';
import { interval } from 'rxjs';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  LocalTrackPublication,
  createLocalTracks,
  Track,
} from 'livekit-client';
import { LivekitService } from '../../services/livekit.service';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { AppGradientButtonComponent } from '../primitives/gradient-button/gradient-button.component';
import { LiveChatOverlayComponent } from '../live-chat-overlay/live-chat-overlay.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-video-call',
  imports: [
    HlmButton,
    AppButtonSecondaryComponent,
    AppGradientButtonComponent,
    LiveChatOverlayComponent,
    AppSkeletonLoaderComponent,
    TranslatePipe,
  ],
  template: `
    <section
      class="fixed inset-0 z-50 bg-surface-900 flex flex-col"
      role="dialog"
      [attr.aria-label]="'video_call.end_call_aria' | t"
    >
      <!-- Remote Video (full screen background) -->
      <div class="flex-1 relative bg-surface-900">
        @if (connectionState() === 'connecting') {
          <div class="flex items-center justify-center h-full">
            <div class="text-center text-white/60 space-y-4">
              <app-skeleton-loader [height]="'80px'" [width]="'80px'" [variant]="'circle'" />
              <app-skeleton-loader [height]="'16px'" [width]="'200px'" [variant]="'text'" />
              <p class="text-sm text-white/50" aria-live="polite">
                {{ 'video_call.connecting' | t }}
              </p>
            </div>
          </div>
        } @else if (connectionState() === 'error') {
          <div class="flex items-center justify-center h-full">
            <div class="text-center text-white/60 space-y-4 px-6">
              <span class="text-5xl" aria-hidden="true">&#9888;&#65039;</span>
              <h3 class="text-lg font-bold text-danger">
                {{ 'videoClassroomErrorBoundary.title' | t }}
              </h3>
              <p class="text-sm text-white/50">
                {{ 'videoClassroomErrorBoundary.description' | t }}
              </p>
              <button
                hlmBtn
                type="button"
                (click)="endCall()"
                class="rounded-full bg-danger hover:bg-danger/90 text-on-fill font-bold px-6 py-2.5 text-sm transition-colors"
              >
                {{ 'video_call.end_call_aria' | t }}
              </button>
            </div>
          </div>
        } @else if (mainVideoTrack()) {
          <video
            #remoteVideo
            autoplay
            playsinline
            class="w-full h-full object-cover"
            [attr.aria-label]="'video_call.remote_video_aria' | t"
          ></video>
        } @else {
          <div
            class="flex items-center justify-center h-full"
            role="img"
            [attr.aria-label]="
              'video_call.remote_avatar_aria' | t: { initials: otherUserInitials() }
            "
          >
            <div class="text-center text-white/60">
              <div class="text-4xl sm:text-6xl mb-3 sm:mb-4" aria-hidden="true">
                {{ otherUserInitials() }}
              </div>
              <p class="text-base sm:text-xl" aria-live="polite">
                {{ 'video_call.waiting_for' | t: { name: otherUserName() } }}
              </p>
            </div>
          </div>
        }

        @if (isRemoteScreenSharing()) {
          <div class="absolute top-2 sm:top-4 inset-x-0 flex justify-center pointer-events-none">
            <div
              class="bg-black/60 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-white text-[10px] sm:text-xs backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              {{ 'video_call.remote_presenting' | t: { name: otherUserName() } }}
            </div>
          </div>

          @if (remoteCameraTrack()) {
            <div
              class="absolute bottom-3 sm:bottom-4 start-3 sm:start-4 w-[72px] sm:w-24 h-[108px] sm:h-36 rounded-lg sm:rounded-xl overflow-hidden shadow-lg border-2 border-surface-50/30"
            >
              <video
                #remoteCameraVideo
                autoplay
                playsinline
                class="w-full h-full object-cover"
                [attr.aria-label]="'video_call.remote_camera_aria' | t"
              ></video>
            </div>
          }
        }

        <!-- Local Camera Preview (PiP overlay) -->
        <div
          class="absolute top-3 sm:top-4 end-3 sm:end-4 w-24 sm:w-32 h-36 sm:h-48 rounded-lg sm:rounded-xl overflow-hidden shadow-lg border-2 border-surface-50/30"
          role="region"
          [attr.aria-label]="'video_call.local_video_aria' | t"
        >
          @if (localVideoTrack()) {
            <video
              #localVideo
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
            ></video>
          } @else {
            <div class="w-full h-full bg-surface-800 flex items-center justify-center">
              <span class="text-white/40 text-xl sm:text-3xl" aria-hidden="true">{{
                otherUserInitials()
              }}</span>
            </div>
          }
        </div>

        @if (isScreenSharing()) {
          <div
            class="absolute bottom-3 sm:bottom-4 end-3 sm:end-4 bg-success/90 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-on-fill text-[10px] sm:text-xs font-semibold"
            role="status"
            [attr.aria-label]="'video_call.presenting_badge_aria' | t"
          >
            {{ 'video_call.you_are_presenting' | t }}
          </div>
        }

        <!-- Call duration -->
        <div
          class="absolute top-2 sm:top-4 start-3 sm:start-4 text-white/80 text-xs sm:text-sm font-mono"
          role="timer"
          [attr.aria-label]="'video_call.call_duration_aria' | t"
        >
          {{ callDuration() }}
        </div>

        <!-- Live chat overlay over host video stream -->
        <app-live-chat-overlay [roomId]="roomName()"></app-live-chat-overlay>
      </div>

      <!-- Controls bar -->
      <div
        class="bg-surface-900/95 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-4 flex-wrap"
        role="toolbar"
        [attr.aria-label]="'video_call.controls_toolbar_aria' | t"
      >
        <!-- Mute/Unmute Audio -->
        <app-button-secondary
          [customClass]="
            isAudioMuted()
              ? 'bg-danger hover:bg-danger/90 rounded-full w-11 h-11 sm:w-14 sm:h-14'
              : 'bg-white/20 hover:bg-white/30 rounded-full w-11 h-11 sm:w-14 sm:h-14'
          "
          [ariaLabel]="
            (isAudioMuted() ? 'video_call.unmute_audio_aria' : 'video_call.mute_audio_aria') | t
          "
          [ariaPressed]="isAudioMuted()"
          (clicked)="toggleAudio()"
        >
          @if (isAudioMuted()) {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          } @else {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          }
        </app-button-secondary>

        <!-- Mute/Unmute Video -->
        <app-button-secondary
          [customClass]="
            isVideoMuted()
              ? 'bg-danger hover:bg-danger/90 rounded-full w-11 h-11 sm:w-14 sm:h-14'
              : 'bg-white/20 hover:bg-white/30 rounded-full w-11 h-11 sm:w-14 sm:h-14'
          "
          [ariaLabel]="
            (isVideoMuted() ? 'video_call.unmute_video_aria' : 'video_call.mute_video_aria') | t
          "
          [ariaPressed]="isVideoMuted()"
          (clicked)="toggleVideo()"
        >
          @if (isVideoMuted()) {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" />
            </svg>
          } @else {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          }
        </app-button-secondary>

        <!-- Screen Share -->
        <app-button-secondary
          [customClass]="
            isScreenSharing()
              ? 'bg-success hover:bg-success/90 rounded-full w-11 h-11 sm:w-14 sm:h-14'
              : 'bg-white/20 hover:bg-white/30 rounded-full w-11 h-11 sm:w-14 sm:h-14'
          "
          [ariaLabel]="
            (isScreenSharing()
              ? 'video_call.stop_screen_share_aria'
              : 'video_call.start_screen_share_aria'
            ) | t
          "
          [ariaPressed]="isScreenSharing()"
          (clicked)="toggleScreenShare()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 sm:h-6 sm:w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </app-button-secondary>

        @if (pipAvailable()) {
          <app-button-secondary
            [customClass]="
              isInPip()
                ? 'bg-secondary hover:bg-secondary/90 rounded-full w-11 h-11 sm:w-14 sm:h-14'
                : 'bg-white/20 hover:bg-white/30 rounded-full w-11 h-11 sm:w-14 sm:h-14'
            "
            [ariaLabel]="(isInPip() ? 'video_call.exit_pip_aria' : 'video_call.enter_pip_aria') | t"
            [ariaPressed]="isInPip()"
            (clicked)="togglePip()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 sm:h-6 sm:w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14l11-11" />
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            </svg>
          </app-button-secondary>
        }

        <!-- End Call -->
        <app-gradient-button
          size="md"
          [customClass]="'rounded-full w-11 h-11 sm:w-16 sm:h-16 bg-danger hover:bg-danger/90'"
          [ariaLabel]="'video_call.end_call_aria' | t"
          (clicked)="endCall()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 sm:h-7 sm:w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
            />
          </svg>
        </app-gradient-button>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class VideoCallComponent implements OnInit, OnDestroy {
  private livekitService = inject(LivekitService);

  // View children for video elements
  readonly remoteVideoRef = viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');
  readonly localVideoRef = viewChild<ElementRef<HTMLVideoElement>>('localVideo');
  readonly remoteCameraVideoRef = viewChild<ElementRef<HTMLVideoElement>>('remoteCameraVideo');

  // Inputs
  readonly roomName = input.required<string>();
  readonly otherUserId = input.required<string>();
  readonly currentUserId = input.required<string>();
  readonly otherUserName = input<string>('User');
  readonly otherUserInitials = input<string>('?');

  // Outputs
  readonly callEnded = output<void>();

  // State
  private room: Room | null = null;
  private localVideo: LocalVideoTrack | null = null;
  private localAudio: LocalAudioTrack | null = null;
  // Bound handlers for cleanup to prevent listener leaks
  private onTrackSubscribedBound: ((track: RemoteTrack) => void) | null = null;
  private onTrackUnsubscribedBound: ((track: RemoteTrack) => void) | null = null;
  private onLocalTrackPublishedBound: ((publication: LocalTrackPublication) => void) | null = null;
  private onLocalTrackUnpublishedBound: ((publication: LocalTrackPublication) => void) | null =
    null;
  private onParticipantDisconnectedBound: (() => void) | null = null;
  private onDisconnectedBound: (() => void) | null = null;

  readonly remoteCameraTrack = signal<RemoteTrack | null>(null);
  readonly remoteScreenShareTrack = signal<RemoteTrack | null>(null);
  readonly mainVideoTrack = computed<RemoteTrack | null>(
    () => this.remoteScreenShareTrack() ?? this.remoteCameraTrack(),
  );
  readonly isRemoteScreenSharing = computed(() => this.remoteScreenShareTrack() !== null);
  readonly localVideoTrack = signal<LocalVideoTrack | null>(null);
  readonly isAudioMuted = signal(false);
  readonly isVideoMuted = signal(false);
  readonly callDuration = signal('00:00');
  readonly isInPip = signal(false);
  readonly pipAvailable = computed(
    () => typeof document !== 'undefined' && document.pictureInPictureEnabled,
  );
  readonly isScreenSharing = signal(false);
  readonly connectionState = signal<'connecting' | 'connected' | 'error'>('connecting');
  private callStartTime: number = 0;
  private durationSub: { unsubscribe(): void } | null = null;

  constructor() {
    // React to the main (screen share, falling back to camera) remote track and detach the
    // previous one so a swap between camera and screen share doesn't leave a stale attachment.
    let previousMainTrack: RemoteTrack | null = null;
    effect(() => {
      const track = this.mainVideoTrack();
      const videoEl = this.remoteVideoRef()?.nativeElement;
      if (previousMainTrack && previousMainTrack !== track) {
        previousMainTrack.detach();
      }
      if (track && videoEl) {
        track.attach(videoEl);
      }
      previousMainTrack = track;
    });

    // React to the remote participant's camera track when it's shown as a secondary
    // thumbnail (i.e. while their screen share occupies the main view).
    effect(() => {
      const track = this.remoteCameraTrack();
      const videoEl = this.remoteCameraVideoRef()?.nativeElement;
      if (track && videoEl) {
        track.attach(videoEl);
      }
    });

    effect(() => {
      const track = this.localVideoTrack();
      const videoEl = this.localVideoRef()?.nativeElement;
      if (track && videoEl) {
        track.attach(videoEl);
      }
    });

    // Listen for Picture‑in‑Picture events on the remote video element
    effect((onCleanup) => {
      const videoEl = this.remoteVideoRef()?.nativeElement;
      if (!videoEl) return;
      const handleEnter = () => this.isInPip.set(true);
      const handleLeave = () => this.isInPip.set(false);
      videoEl.addEventListener('enterpictureinpicture', handleEnter);
      videoEl.addEventListener('leavepictureinpicture', handleLeave);
      onCleanup(() => {
        videoEl.removeEventListener('enterpictureinpicture', handleEnter);
        videoEl.removeEventListener('leavepictureinpicture', handleLeave);
      });
    });
  }

  // Integration with LiveKit requires imperative setup; exception permitted per AGENTS.md 5.3
  async ngOnInit(): Promise<void> {
    this.connectionState.set('connecting');
    try {
      const tokenResult = await this.livekitService.getToken(this.roomName(), this.currentUserId());

      this.livekitService.isDegraded.set(tokenResult.degraded);
      if (tokenResult.degradationReason) {
        this.livekitService.degradationReason.set(tokenResult.degradationReason);
      }

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 640, height: 480 },
        },
      });

      this.onTrackSubscribedBound = this.onTrackSubscribed.bind(this);
      this.onTrackUnsubscribedBound = this.onTrackUnsubscribed.bind(this);
      this.onLocalTrackPublishedBound = this.onLocalTrackPublished.bind(this);
      this.onLocalTrackUnpublishedBound = this.onLocalTrackUnpublished.bind(this);
      this.onParticipantDisconnectedBound = this.onParticipantDisconnected.bind(this);
      this.onDisconnectedBound = this.onDisconnected.bind(this);

      this.room
        .on(RoomEvent.TrackSubscribed, this.onTrackSubscribedBound)
        .on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribedBound)
        .on(RoomEvent.LocalTrackPublished, this.onLocalTrackPublishedBound)
        .on(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublishedBound)
        .on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnectedBound)
        .on(RoomEvent.Disconnected, this.onDisconnectedBound);

      await this.room.connect(this.livekitService.getLiveKitUrl(), tokenResult.token);

      // Create and publish local tracks using createLocalTracks
      const tracks = await createLocalTracks({ audio: true, video: true });
      for (const track of tracks) {
        if (track instanceof LocalVideoTrack) {
          this.localVideo = track;
          this.localVideoTrack.set(track);
          await this.room.localParticipant.publishTrack(track);
        } else if (track instanceof LocalAudioTrack) {
          this.localAudio = track;
          await this.room.localParticipant.publishTrack(track);
        }
      }

      this.connectionState.set('connected');

      // Start call duration timer
      this.callStartTime = Date.now();
      this.durationSub = interval(1000).subscribe(() => {
        const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        this.callDuration.set(
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
        );
      });
    } catch {
      this.connectionState.set('error');
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private onTrackSubscribed(track: RemoteTrack): void {
    if (track.kind !== Track.Kind.Video) return;
    if (track.source === Track.Source.ScreenShare) {
      this.remoteScreenShareTrack.set(track);
    } else {
      this.remoteCameraTrack.set(track);
    }
  }

  private onTrackUnsubscribed(track: RemoteTrack): void {
    if (track.kind !== Track.Kind.Video) return;
    if (track.source === Track.Source.ScreenShare) {
      this.remoteScreenShareTrack.set(null);
    } else {
      this.remoteCameraTrack.set(null);
    }
  }

  private onLocalTrackPublished(publication: LocalTrackPublication): void {
    if (publication.source === Track.Source.ScreenShare) {
      this.isScreenSharing.set(true);
    }
  }

  private onLocalTrackUnpublished(publication: LocalTrackPublication): void {
    if (publication.source === Track.Source.ScreenShare) {
      this.isScreenSharing.set(false);
    }
  }

  private onParticipantDisconnected(): void {
    this.endCall();
  }

  private onDisconnected(): void {
    this.cleanup();
    this.callEnded.emit();
  }

  toggleAudio(): void {
    if (!this.localAudio) return;
    if (this.isAudioMuted()) {
      this.localAudio.unmute();
      this.isAudioMuted.set(false);
    } else {
      this.localAudio.mute();
      this.isAudioMuted.set(true);
    }
  }

  toggleVideo(): void {
    if (!this.localVideo) return;
    if (this.isVideoMuted()) {
      this.localVideo.unmute();
      this.isVideoMuted.set(false);
    } else {
      this.localVideo.mute();
      this.isVideoMuted.set(true);
    }
  }

  async toggleScreenShare(): Promise<void> {
    if (!this.room) return;
    try {
      await this.livekitService.toggleScreenShare(!this.isScreenSharing(), this.room);
    } catch {
      // User cancelled the share picker or denied permission; state is unchanged.
    }
  }

  endCall(): void {
    this.cleanup();
    this.callEnded.emit();
  }

  async togglePip(): Promise<void> {
    if (!document.pictureInPictureEnabled) return;
    const videoEl = this.remoteVideoRef()?.nativeElement;
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.isInPip.set(false);
      } else {
        await videoEl.requestPictureInPicture();
        this.isInPip.set(true);
      }
    } catch {
      // ignore
    }
  }

  private cleanup(): void {
    if (this.durationSub) {
      this.durationSub.unsubscribe();
      this.durationSub = null;
    }

    // Detach all remote tracks from video elements before stopping them
    this.remoteCameraTrack()?.detach();
    this.remoteScreenShareTrack()?.detach();

    if (this.localVideo) {
      this.localVideo.stop();
      this.localVideo = null;
    }

    if (this.localAudio) {
      this.localAudio.stop();
      this.localAudio = null;
    }

    if (this.room) {
      if (this.onTrackSubscribedBound) {
        this.room.off(RoomEvent.TrackSubscribed, this.onTrackSubscribedBound);
        this.onTrackSubscribedBound = null;
      }
      if (this.onTrackUnsubscribedBound) {
        this.room.off(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribedBound);
        this.onTrackUnsubscribedBound = null;
      }
      if (this.onLocalTrackPublishedBound) {
        this.room.off(RoomEvent.LocalTrackPublished, this.onLocalTrackPublishedBound);
        this.onLocalTrackPublishedBound = null;
      }
      if (this.onLocalTrackUnpublishedBound) {
        this.room.off(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublishedBound);
        this.onLocalTrackUnpublishedBound = null;
      }
      if (this.onParticipantDisconnectedBound) {
        this.room.off(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnectedBound);
        this.onParticipantDisconnectedBound = null;
      }
      if (this.onDisconnectedBound) {
        this.room.off(RoomEvent.Disconnected, this.onDisconnectedBound);
        this.onDisconnectedBound = null;
      }
      this.room.disconnect();
      this.room = null;
    }

    // Exit Picture‑in‑Picture if active
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }

    this.localVideoTrack.set(null);
    this.remoteCameraTrack.set(null);
    this.remoteScreenShareTrack.set(null);
    this.isScreenSharing.set(false);
    this.isAudioMuted.set(false);
    this.isVideoMuted.set(false);
    this.isInPip.set(false);
  }
}
