import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  OnDestroy,
  effect,
} from '@angular/core';

import { interval } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { LivekitService } from '../../services/livekit.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { Room, LocalTrack, RemoteTrack, Track } from 'livekit-client';

export type CallDirection = 'incoming' | 'outgoing';
export type CallState = 'ringing' | 'connecting' | 'connected' | 'ended' | 'missed' | 'rejected';

@Component({
  selector: 'app-voip-call',
  imports: [HlmButton, FormsModule],
  template: `
    @if (showCallUI()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div
          class="bg-surface-900 rounded-2xl shadow-2xl w-full max-w-sm ps-6 pe-6 pt-6 pb-6 text-center border border-surface-50/30"
        >
          <!-- Caller/Callee Info -->
          <div class="mb-6">
            <div
              class="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl font-bold text-white mb-3"
            >
              {{ displayName()[0]?.toUpperCase() || '?' }}
            </div>
            <h2 class="text-xl font-semibold text-white">{{ displayName() }}</h2>
            <p class="text-text-muted text-sm mt-1">{{ callStatusText() }}</p>
          </div>

          <!-- Call Timer (when connected) -->
          @if (callState() === 'connected') {
            <div class="text-3xl font-mono text-white mb-6">
              {{ formattedDuration() }}
            </div>
          }

          <!-- Action Buttons -->
          <div class="flex justify-center gap-6">
            <!-- Incoming call actions -->
            @if (callDirection() === 'incoming' && callState() === 'ringing') {
              <button
                hlmBtn
                (click)="acceptCall()"
                class="w-16 h-16 rounded-full bg-success hover:bg-success/90 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
              >
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </button>
              <button
                hlmBtn
                (click)="rejectCall()"
                class="w-16 h-16 rounded-full bg-danger hover:bg-danger/90 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
              >
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            }

            <!-- Outgoing / Connected call actions -->
            @if (
              callDirection() === 'outgoing' ||
              callState() === 'connected' ||
              callState() === 'connecting'
            ) {
              <button
                hlmBtn
                (click)="toggleMute()"
                [class]="
                  isMuted()
                    ? 'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg bg-warning hover:bg-warning/90'
                    : 'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg bg-white/20 hover:bg-white/30'
                "
              >
                <svg
                  class="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
              <button
                hlmBtn
                (click)="toggleVideo()"
                [class]="
                  isVideoEnabled()
                    ? 'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg bg-white/20 hover:bg-white/30'
                    : 'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg bg-warning hover:bg-warning/90'
                "
              >
                <svg
                  class="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                hlmBtn
                (click)="endCall()"
                class="w-16 h-16 rounded-full bg-danger hover:bg-danger/90 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
              >
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.28 3H5z"
                  />
                </svg>
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class VoipCallComponent implements OnDestroy {
  private livekitService = inject(LivekitService);
  private authService = inject(AuthService);
  private chatService = inject(ChatService);

  // Inputs
  readonly callDirection = input.required<CallDirection>();
  readonly remoteUserId = input.required<string>();
  readonly displayName = input.required<string>();
  readonly roomName = input.required<string>();
  readonly isVideoCall = input<boolean>(false);

  // Outputs
  readonly callEnded = output<void>();
  readonly callAccepted = output<void>();
  readonly callRejected = output<void>();
  readonly muteToggled = output<boolean>();

  // State signals
  readonly showCallUI = signal(true);
  readonly callState = signal<CallState>('ringing');
  readonly isMuted = signal(false);
  readonly isVideoEnabled = signal(false);
  readonly callDurationSeconds = signal(0);

  readonly callStatusText = computed(() => {
    switch (this.callState()) {
      case 'ringing':
        return this.callDirection() === 'incoming' ? 'Incoming call...' : 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'ended':
        return 'Call ended';
      case 'missed':
        return 'Missed call';
      case 'rejected':
        return 'Call rejected';
      default:
        return '';
    }
  });

  readonly formattedDuration = computed(() => {
    const totalSeconds = this.callDurationSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  private callDurationSub: { unsubscribe(): void } | null = null;
  private localAudioTrack: LocalTrack | null = null;
  private localVideoTrack: LocalTrack | null = null;
  private remoteAudioTrack: RemoteTrack | null = null;
  private remoteVideoTrack: RemoteTrack | null = null;
  private room: Room | null = null;

  constructor() {
    // Auto-start timer when connected
    effect(() => {
      if (this.callState() === 'connected') {
        this.startDurationTimer();
      } else {
        this.stopDurationTimer();
      }
    });

    // Auto-enable video if it's a video call
    effect(() => {
      if (this.isVideoCall()) {
        this.isVideoEnabled.set(true);
      }
    });
  }

  async acceptCall(): Promise<void> {
    this.callState.set('connecting');
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('User not authenticated');

      // Join the LiveKit room
      this.room = await this.livekitService.joinRoom(
        this.roomName(),
        currentUser.id,
        this.isVideoCall(),
      );

      // Publish local tracks
      const tracks = await this.livekitService.publishTracks();
      this.localAudioTrack = tracks.audioTrack;
      this.localVideoTrack = tracks.videoTrack;

      // Subscribe to remote tracks
      this.livekitService.onTrackSubscribed = (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          this.remoteAudioTrack = track;
        } else if (track.kind === Track.Kind.Video) {
          this.remoteVideoTrack = track;
        }
        // Attach to video/audio element in parent component
      };

      this.callState.set('connected');
      this.callAccepted.emit();

      // Notify the caller via chat that call was accepted
      await this.chatService.sendMessage({
        room_id: this.roomName(),
        message_type: 'text',
        text_content: 'Call accepted',
      });
    } catch {
      this.callState.set('ended');
    }
  }

  async rejectCall(): Promise<void> {
    this.callState.set('rejected');
    this.showCallUI.set(false);
    this.callRejected.emit();

    // Notify the caller
    await this.chatService.sendMessage({
      room_id: this.roomName(),
      message_type: 'text',
      text_content: 'Call rejected',
    });
  }

  async endCall(): Promise<void> {
    this.callState.set('ended');
    this.cleanup();
    this.showCallUI.set(false);
    this.callEnded.emit();
  }

  async toggleMute(): Promise<void> {
    const newMuted = !this.isMuted();
    this.isMuted.set(newMuted);
    this.muteToggled.emit(newMuted);

    // Mute/unmute the local audio track via LiveKit SDK
    if (this.localAudioTrack) {
      if (newMuted) {
        await this.localAudioTrack.mute();
      } else {
        await this.localAudioTrack.unmute();
      }
    }
  }

  async toggleVideo(): Promise<void> {
    this.isVideoEnabled.update((v) => !v);
    // Toggle the camera on the local participant
    if (this.room) {
      await this.room.localParticipant.setCameraEnabled(this.isVideoEnabled());
    }
  }

  private startDurationTimer(): void {
    this.callDurationSeconds.set(0);
    this.stopDurationTimer();
    this.callDurationSub = interval(1000).subscribe(() => {
      this.callDurationSeconds.update((v) => v + 1);
    });
  }

  private stopDurationTimer(): void {
    if (this.callDurationSub) {
      this.callDurationSub.unsubscribe();
      this.callDurationSub = null;
    }
  }

  private cleanup(): void {
    this.stopDurationTimer();
    this.livekitService.leaveRoom();
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.remoteAudioTrack = null;
    this.remoteVideoTrack = null;
    this.room = null;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
