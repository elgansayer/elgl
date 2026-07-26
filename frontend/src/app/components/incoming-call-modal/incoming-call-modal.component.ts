import { Component, input, output, effect, OnDestroy, viewChild, ElementRef } from '@angular/core';

export interface IncomingCallData {
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  roomName: string;
  isVideoCall: boolean;
}

@Component({
  selector: 'app-incoming-call-modal',
  standalone: true,
  imports: [],
  template: `
    @if (callData(); as data) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          class="bg-surface-800 border border-slate-700 rounded-3xl p-8 w-full max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          <!-- Caller Info -->
          <div class="flex flex-col items-center space-y-4 mb-8">
            <div class="relative">
              @if (data.callerAvatarUrl) {
                <img
                  [src]="data.callerAvatarUrl"
                  [alt]="data.callerName"
                  class="w-24 h-24 rounded-full object-cover ring-4 ring-purple-500/50"
                />
              } @else {
                <div
                  class="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-500/50"
                >
                  <span class="text-4xl font-bold text-white">
                    {{ data.callerName.charAt(0).toUpperCase() }}
                  </span>
                </div>
              }
              <div
                class="absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-green-500 border-4 border-slate-900"
              ></div>
            </div>
            <div class="text-center">
              <h2 class="text-2xl font-bold text-white">{{ data.callerName }}</h2>
              <p class="text-text-muted mt-1">
                {{ data.isVideoCall ? 'Incoming video call...' : 'Incoming voice call...' }}
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-6">
            <!-- Decline Button -->
            <button
              (click)="onDecline()"
              class="flex flex-col items-center gap-2 group"
              aria-label="Decline call"
            >
              <div
                class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/40 transition-colors duration-150"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-8 h-8 text-red-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
              <span class="text-sm text-text-muted group-hover:text-slate-300">Decline</span>
            </button>

            <!-- Accept Button -->
            <button
              (click)="onAccept()"
              class="flex flex-col items-center gap-2 group"
              aria-label="Accept call"
            >
              <div
                class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/40 transition-colors duration-150 animate-pulse"
              >
                @if (data.isVideoCall) {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-8 h-8 text-green-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                } @else {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-8 h-8 text-green-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                    ></path>
                  </svg>
                }
              </div>
              <span class="text-sm text-green-400 group-hover:text-green-300">Accept</span>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Hidden audio element for ringtone -->
    @if (callData()) {
      <audio #ringtoneAudio [src]="ringtoneUrl()" loop autoplay class="hidden"></audio>
    }
  `,
  styles: [
    `
      @keyframes zoom-in-95 {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .animate-in.zoom-in-95 {
        animation: zoom-in-95 0.2s ease-out;
      }
    `,
  ],
})
export class IncomingCallModalComponent implements OnDestroy {
  /** Input: The incoming call invitation data */
  callData = input<IncomingCallData | null>(null);

  /** Input: URL to a ringtone audio file (optional, defaults to a built-in beep) */
  ringtoneUrl = input<string>('/assets/audio/ringtone.mp3');

  /** Emits when user accepts the call */
  acceptCall = output<IncomingCallData>();

  /** Emits when user declines the call */
  declineCall = output<IncomingCallData>();

  /** Reference to the audio element in the template */
  private ringtoneAudioRef = viewChild<ElementRef<HTMLAudioElement>>('ringtoneAudio');

  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
    // Auto-play ringtone when callData appears
    effect(() => {
      const data = this.callData();
      if (data) {
        this.playRingtone();
      } else {
        this.stopRingtone();
      }
    });
  }

  private playRingtone(): void {
    const url = this.ringtoneUrl();
    if (!url) {
      this.playFallbackBeep();
      return;
    }

    // Try to play the audio file via the template audio element
    const audioEl = this.ringtoneAudioRef()?.nativeElement;
    if (audioEl) {
      audioEl.loop = true;
      audioEl.volume = 0.5;
      audioEl.play().catch(() => {
        // Autoplay may be blocked; fallback to beep
        this.playFallbackBeep();
      });
    } else {
      // Fallback if template element not available
      this.playFallbackBeep();
    }
  }

  private playFallbackBeep(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.oscillator.frequency.value = 440; // A4 note
      this.oscillator.type = 'sine';
      this.gainNode.gain.value = 0.3;

      this.oscillator.start();
    } catch {
      // Silently fail if audio context not available
    }
  }

  private stopRingtone(): void {
    // Stop HTML audio element
    const audioEl = this.ringtoneAudioRef()?.nativeElement;
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }

    // Stop fallback beep
    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch {
        // Already stopped
      }
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  onAccept(): void {
    const data = this.callData();
    if (data) {
      this.stopRingtone();
      this.acceptCall.emit(data);
    }
  }

  onDecline(): void {
    const data = this.callData();
    if (data) {
      this.stopRingtone();
      this.declineCall.emit(data);
    }
  }

  ngOnDestroy(): void {
    this.stopRingtone();
  }
}
