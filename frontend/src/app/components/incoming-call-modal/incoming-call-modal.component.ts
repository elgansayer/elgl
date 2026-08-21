import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  input,
  output,
  effect,
  viewChild,
  ElementRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

export interface IncomingCallData {
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  roomName: string;
  isVideoCall: boolean;
}

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext: typeof AudioContext;
}

function hasWebkitAudioContext(win: Window): win is WindowWithWebkitAudioContext {
  return 'webkitAudioContext' in win;
}

function getAudioContextClass(): typeof AudioContext | undefined {
  if (window.AudioContext) return window.AudioContext;
  if (hasWebkitAudioContext(window)) return window.webkitAudioContext;
  return undefined;
}

@Component({
  selector: 'app-incoming-call-modal',
  imports: [HlmButton, TranslatePipe],
  template: `
    @if (callData(); as data) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4"
      >
        <div
          class="bg-surface-200 border border-surface-100 rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
        >
          <!-- Caller Info -->
          <div class="flex flex-col items-center space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            <div class="relative">
              @if (data.callerAvatarUrl) {
                <img
                  [src]="data.callerAvatarUrl"
                  [alt]="'voip.callerAvatar' | t: { name: data.callerName }"
                  class="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-secondary/50"
                  loading="lazy"
                />
              } @else {
                <div
                  class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center ring-4 ring-secondary/50"
                >
                  <span class="text-3xl sm:text-4xl font-bold text-on-fill">
                    {{ data.callerName.charAt(0).toUpperCase() }}
                  </span>
                </div>
              }
              <div
                class="absolute -bottom-1 -end-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-success border-4 border-surface-200"
              ></div>
            </div>
            <div class="text-center">
              <h2 class="text-xl sm:text-2xl font-bold text-text-primary">{{ data.callerName }}</h2>
              <p class="text-sm text-text-muted mt-1">
                @if (data.isVideoCall) {
                  {{ 'voip.incomingVideoCall' | t }}
                } @else {
                  {{ 'voip.incomingVoiceCall' | t }}
                }
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-4 sm:gap-6">
            <!-- Decline Button -->
            <button
              hlmBtn
              (click)="onDecline()"
              class="flex flex-col items-center gap-1.5 sm:gap-2 group"
              [attr.aria-label]="'voip.decline' | t"
            >
              <div
                class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-danger/20 flex items-center justify-center group-hover:bg-danger/40 transition-colors duration-150"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-6 h-6 sm:w-8 sm:h-8 text-danger"
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
              <span class="text-xs sm:text-sm text-text-muted group-hover:text-text-secondary">{{
                'voip.decline' | t
              }}</span>
            </button>

            <!-- Accept Button -->
            <button
              hlmBtn
              (click)="onAccept()"
              class="flex flex-col items-center gap-1.5 sm:gap-2 group"
              [attr.aria-label]="'voip.accept' | t"
            >
              <div
                class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-success/20 flex items-center justify-center group-hover:bg-success/40 transition-colors duration-150 animate-pulse"
              >
                @if (data.isVideoCall) {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-6 h-6 sm:w-8 sm:h-8 text-success"
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
                    class="w-6 h-6 sm:w-8 sm:h-8 text-success"
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
              <span class="text-xs sm:text-sm text-success group-hover:text-success/80">{{
                'voip.accept' | t
              }}</span>
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
export class IncomingCallModalComponent {
  /** Input: The incoming call invitation data */
  callData = input<IncomingCallData | null>(null);

  /** Input: URL to a ringtone audio file (optional, defaults to a built-in beep) */
  ringtoneUrl = input<string>('/assets/audio/ringtone.wav');

  /** Emits when user accepts the call */
  acceptCall = output<IncomingCallData>();

  /** Emits when user declines the call */
  declineCall = output<IncomingCallData>();

  /** Reference to the audio element in the template */
  private ringtoneAudioRef = viewChild<ElementRef<HTMLAudioElement>>('ringtoneAudio');

  private destroyRef = inject(DestroyRef);
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

    // Ensure ringtone is stopped when component is destroyed
    this.destroyRef.onDestroy(() => {
      this.stopRingtone();
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
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
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
}
