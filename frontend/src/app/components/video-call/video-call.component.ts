import { Component, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoCallService } from '../../services/video-call.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, AppButtonPrimaryComponent, AppButtonSecondaryComponent],
  template: `
    @if (videoCallService.callState(); as callState) {
      <div class="fixed inset-0 z-50 bg-black">
        <!-- Remote Video (full screen) -->
        <div class="absolute inset-0">
          @if (videoCallService.remoteVideoTrack(); as remoteTrack) {
            <video
              #remoteVideo
              [srcObject]="remoteStream"
              autoplay
              playsinline
              class="w-full h-full object-cover"
            ></video>
          } @else {
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="w-24 h-24 rounded-full bg-slate-700 mx-auto mb-4 flex items-center justify-center">
                  <svg class="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p class="text-slate-400 text-lg">Waiting for other person...</p>
              </div>
            </div>
          }
        </div>

        <!-- Local Preview Overlay (picture-in-picture) -->
        <div class="absolute top-4 end-4 w-32 h-48 md:w-48 md:h-64 rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 z-10">
          @if (videoCallService.localVideoTrack(); as localTrack) {
            <video
              #localVideo
              [srcObject]="localStream"
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
            ></video>
          } @else {
            <div class="w-full h-full bg-slate-800 flex items-center justify-center">
              <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          }
        </div>

        <!-- Call Duration -->
        <div class="absolute top-4 start-1/2 -translate-x-1/2 bg-black/50 rounded-full px-4 py-2 z-10">
          <span class="text-white text-sm font-medium">{{ formatDuration(callState.callDuration) }}</span>
        </div>

        <!-- Control Bar -->
        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
          <!-- Mute/Unmute -->
          <app-button-secondary
            [customClass]="callState.isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'"
            (clicked)="toggleMute()"
          >
            @if (callState.isMuted) {
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            } @else {
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            }
          </app-button-secondary>

          <!-- Toggle Video -->
          <app-button-secondary
            [customClass]="callState.isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'"
            (clicked)="toggleVideo()"
          >
            @if (callState.isVideoOff) {
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            } @else {
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          </app-button-secondary>

          <!-- Switch Camera -->
          <app-button-secondary
            customClass="bg-white/20 hover:bg-white/30"
            (clicked)="switchCamera()"
          >
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </app-button-secondary>

          <!-- End Call -->
          <app-button-primary
            customClass="bg-red-500 hover:bg-red-600 w-16 h-16 rounded-full"
            (clicked)="endCall()"
          >
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </app-button-primary>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `],
})
export class VideoCallComponent implements OnInit, OnDestroy {
  readonly videoCallService = inject(VideoCallService);

  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;

  private trackEffect = effect(() => {
    const localTrack = this.videoCallService.localVideoTrack();
    if (localTrack) {
      this.localStream = new MediaStream([localTrack]);
    } else {
      this.localStream = null;
    }

    const remoteTrack = this.videoCallService.remoteVideoTrack();
    const remoteAudio = this.videoCallService.remoteAudioTrack();
    if (remoteTrack || remoteAudio) {
      const tracks: MediaStreamTrack[] = [];
      if (remoteTrack) tracks.push(remoteTrack);
      if (remoteAudio) tracks.push(remoteAudio);
      this.remoteStream = new MediaStream(tracks);
    } else {
      this.remoteStream = null;
    }
  });

  ngOnInit(): void {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  }

  ngOnDestroy(): void {
    this.videoCallService.endCall();
  }

  toggleMute(): void {
    this.videoCallService.toggleMute();
  }

  toggleVideo(): void {
    this.videoCallService.toggleVideo();
  }

  switchCamera(): void {
    this.videoCallService.switchCamera();
  }

  endCall(): void {
    this.videoCallService.endCall();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
