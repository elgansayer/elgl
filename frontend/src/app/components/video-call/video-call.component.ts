import {
  Component,
  OnInit,
  OnDestroy,
  input,
  output,
  signal,
  effect,
  inject,
  viewChild,
  ElementRef,
} from '@angular/core';

import {
  Room,
  RoomEvent,
  RemoteTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalTracks,
  Track,
} from 'livekit-client';
import { LivekitService } from '../../services/livekit.service';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { AppGradientButtonComponent } from '../primitives/gradient-button/gradient-button.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-video-call',
  imports: [AppButtonSecondaryComponent, AppGradientButtonComponent, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 bg-black flex flex-col">
      <!-- Remote Video (full screen background) -->
      <div class="flex-1 relative bg-gray-900">
        @if (remoteVideoTrack()) {
          <video #remoteVideo autoplay playsinline class="w-full h-full object-cover"></video>
        } @else {
          <div class="flex items-center justify-center h-full">
            <div class="text-center text-white/60">
              <div class="text-6xl mb-4">
                {{ otherUserInitials() }}
              </div>
              <p class="text-xl">{{ 'video_call.waiting_for' | t : { name: otherUserName() } }}</p>
            </div>
          </div>
        }

        <!-- Local Camera Preview (PiP overlay) -->
        <div
          class="absolute top-4 end-4 w-32 h-48 rounded-xl overflow-hidden shadow-lg border-2 border-white/30"
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
            <div class="w-full h-full bg-gray-800 flex items-center justify-center">
              <span class="text-white/40 text-3xl">{{ otherUserInitials() }}</span>
            </div>
          }
        </div>

        <!-- Call duration -->
        <div class="absolute top-4 start-4 text-white/80 text-sm font-mono">
          {{ callDuration() }}
        </div>
      </div>

      <!-- Controls bar -->
      <div class="bg-gray-900/95 backdrop-blur-sm px-6 py-4 flex items-center justify-center gap-4">
        <!-- Mute/Unmute Audio -->
        <app-button-secondary
          [customClass]="
            isAudioMuted()
              ? 'bg-red-500 hover:bg-red-600 rounded-full w-14 h-14'
              : 'bg-white/20 hover:bg-white/30 rounded-full w-14 h-14'
          "
          (clicked)="toggleAudio()"
        >
          @if (isAudioMuted()) {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
              class="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
              ? 'bg-red-500 hover:bg-red-600 rounded-full w-14 h-14'
              : 'bg-white/20 hover:bg-white/30 rounded-full w-14 h-14'
          "
          (clicked)="toggleVideo()"
        >
          @if (isVideoMuted()) {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
              class="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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

        <!-- End Call -->
        <app-gradient-button
          size="md"
          [customClass]="'rounded-full w-16 h-16 bg-red-600 hover:bg-red-700'"
          (clicked)="endCall()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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
    </div>
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

  // Inputs
  readonly roomName = input.required<string>();
  readonly otherUserId = input.required<string>();
  readonly otherUserName = input<string>('User');
  readonly otherUserInitials = input<string>('?');

  // Outputs
  readonly callEnded = output<void>();

  // State
  private room: Room | null = null;
  private localVideo: LocalVideoTrack | null = null;
  private localAudio: LocalAudioTrack | null = null;

  readonly remoteVideoTrack = signal<RemoteTrack | null>(null);
  readonly localVideoTrack = signal<LocalVideoTrack | null>(null);
  readonly isAudioMuted = signal(false);
  readonly isVideoMuted = signal(false);
  readonly callDuration = signal('00:00');
  private callStartTime: number = 0;
  private durationInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // React to remote video track changes to attach/detach
    effect(() => {
      const track = this.remoteVideoTrack();
      const videoEl = this.remoteVideoRef()?.nativeElement;
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
  }

  // Integration with LiveKit requires imperative setup; exception permitted per AGENTS.md 5.3
  async ngOnInit(): Promise<void> {
    try {
      const token = await this.livekitService.getToken(this.roomName(), this.otherUserId());

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 640, height: 480 },
        },
      });

      this.room
        .on(RoomEvent.TrackSubscribed, this.onTrackSubscribed.bind(this))
        .on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed.bind(this))
        .on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected.bind(this))
        .on(RoomEvent.Disconnected, this.onDisconnected.bind(this));

      await this.room.connect(this.livekitService.getLiveKitUrl(), token);

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

      // Start call duration timer
      this.callStartTime = Date.now();
      this.durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        this.callDuration.set(
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
        );
      }, 1000);
    } catch (error) {
      console.error('Failed to start video call:', error);
      this.callEnded.emit();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private onTrackSubscribed(track: RemoteTrack): void {
    if (track.kind === Track.Kind.Video) {
      this.remoteVideoTrack.set(track);
    }
  }

  private onTrackUnsubscribed(track: RemoteTrack): void {
    if (track.kind === Track.Kind.Video) {
      this.remoteVideoTrack.set(null);
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

  endCall(): void {
    this.cleanup();
    this.callEnded.emit();
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    if (this.localVideo) {
      this.localVideo.stop();
      this.localVideo = null;
    }

    if (this.localAudio) {
      this.localAudio.stop();
      this.localAudio = null;
    }

    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }

    this.localVideoTrack.set(null);
    this.remoteVideoTrack.set(null);
  }
}
