<<<<<<< HEAD
import { Component, input, output, effect, OnDestroy, viewChild, ElementRef } from '@angular/core';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
=======
import { Component, input, output, effect, viewChild, ElementRef, inject, DestroyRef } from '@angular/core';
>>>>>>> origin/main
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
<<<<<<< HEAD
  imports: [AppButtonPrimaryComponent, AppButtonSecondaryComponent, TranslatePipe],
=======
  imports: [TranslatePipe],
>>>>>>> origin/main
  template: `
    @if (callData(); as data) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'voip.incomingCallTitle' | t"
      >
        <div
          class="bg-surface-800 border border-slate-700 rounded-3xl p-8 w-full max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          <!-- Caller Info -->
          <div class="flex flex-col items-center mb-8 gap-4">
            <div class="relative">
              @if (data.callerAvatarUrl) {
                <img
                  [src]="data.callerAvatarUrl"
                  [alt]="'voip.callerAvatar' | t: { name: data.callerName }"
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
                @if (data.isVideoCall) {
                  {{ 'voip.incomingVideoCall' | t }}
                } @else {
                  {{ 'voip.incomingVoiceCall' | t }}
                }
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-6">
<<<<<<< HEAD
            <app-button-secondary
              size="lg"
              customClass="!rounded-full !w-16 !h-16 !p-0 !bg-red-500/20 !border-red-500/30 hover:!bg-red-500/40"
              [attr.aria-label]="'voip.decline' | t"
              (clicked)="onDecline()"
=======
            <!-- Decline Button -->
            <button
              (click)="onDecline()"
              class="flex flex-col items-center gap-2 group"
              [attr.aria-label]="'voip.decline' | t"
>>>>>>> origin/main
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
            </app-button-secondary>

            <app-button-primary
              size="lg"
              customClass="!rounded-full !w-16 !h-16 !p-0 !bg-green-500 hover:!bg-green-600 animate-pulse"
              [attr.aria-label]="'voip.accept' | t"
              (clicked)="onAccept()"
            >
              @if (data.isVideoCall) {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-8 h-8 text-white"
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
<<<<<<< HEAD
              } @else {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-8 h-8 text-white"
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
            </app-button-primary>
          </div>

          <!-- Decline / Accept Labels -->
          <div class="flex justify-center gap-6 mt-2">
            <span class="text-xs text-text-muted w-16 text-center">{{ 'voip.decline' | t }}</span>
            <span class="text-xs text-green-400 w-16 text-center">{{ 'voip.accept' | t }}</span>
          </div>

          <!-- Ringing indicator -->
          <div class="text-center mt-4">
            <span class="text-xs text-text-muted animate-pulse">
              {{ 'voip.ringing' | t }}
            </span>
=======
              </div>
              <span class="text-sm text-text-muted group-hover:text-slate-300">{{ 'voip.decline' | t }}</span>
            </button>

            <!-- Accept Button -->
            <button
              (click)="onAccept()"
              class="flex flex-col items-center gap-2 group"
              [attr.aria-label]="'voip.accept' | t"
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
              <span class="text-sm text-green-400 group-hover:text-green-300">{{ 'voip.accept' | t }}</span>
            </button>
>>>>>>> origin/main
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
<<<<<<< HEAD
export class IncomingCallModalComponent implements OnDestroy {
=======
export class IncomingCallModalComponent {
  /** Input: The incoming call invitation data */
>>>>>>> origin/main
  callData = input<IncomingCallData | null>(null);
  ringtoneUrl = input<string>('/assets/audio/ringtone.mp3');
  acceptCall = output<IncomingCallData>();
  declineCall = output<IncomingCallData>();

  private ringtoneAudioRef = viewChild<ElementRef<HTMLAudioElement>>('ringtoneAudio');

  private destroyRef = inject(DestroyRef);
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
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

    const audioEl = this.ringtoneAudioRef()?.nativeElement;
    if (audioEl) {
      audioEl.loop = true;
      audioEl.volume = 0.5;
      audioEl.play().catch(() => {
        this.playFallbackBeep();
      });
    } else {
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

      this.oscillator.frequency.value = 440;
      this.oscillator.type = 'sine';
      this.gainNode.gain.value = 0.3;

      this.oscillator.start();
    } catch {
      // Silently fail if audio context not available
    }
  }

  private stopRingtone(): void {
    const audioEl = this.ringtoneAudioRef()?.nativeElement;
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }

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
