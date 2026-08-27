import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  IncomingCallData,
  normaliseIncomingCallData,
} from './incoming-call-data';

export type { IncomingCallData } from './incoming-call-data';

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext: typeof AudioContext;
}

function hasWebkitAudioContext(win: Window): win is WindowWithWebkitAudioContext {
  return 'webkitAudioContext' in win;
}

@Component({
  selector: 'app-incoming-call-modal',
  imports: [HlmButton, TranslatePipe],
  template: `
    @if (safeCallData(); as data) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4"
        role="presentation"
      >
        <div
          class="incoming-call-dialog bg-surface-200 border border-surface-100 rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incoming-call-title"
          aria-describedby="incoming-call-status"
          [attr.aria-busy]="actionPending()"
        >
          <div class="flex flex-col items-center space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            <div class="relative" aria-hidden="true">
              @if (data.callerAvatarUrl) {
                <img
                  [src]="data.callerAvatarUrl"
                  alt=""
                  class="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-secondary/50"
                  loading="lazy"
                  referrerpolicy="no-referrer"
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
            <div class="text-center min-w-0 w-full">
              <h2
                id="incoming-call-title"
                class="text-xl sm:text-2xl font-bold text-text-primary break-words"
                dir="auto"
              >
                {{ data.callerName }}
              </h2>
              <p id="incoming-call-status" class="text-sm text-text-muted mt-1" role="status">
                @if (data.isVideoCall) {
                  {{ 'voip.incomingVideoCall' | t }}
                } @else {
                  {{ 'voip.incomingVoiceCall' | t }}
                }
                <span class="sr-only">. {{ 'voip.ringing' | t }}</span>
              </p>
            </div>
          </div>

          <div class="flex flex-wrap justify-center gap-4 sm:gap-6">
            <button
              #declineButton
              hlmBtn
              type="button"
              (click)="onDecline()"
              class="min-w-20 min-h-20 flex flex-col items-center justify-center gap-1.5 sm:gap-2 group disabled:opacity-60"
              [disabled]="actionPending()"
              [attr.aria-label]="'voip.decline' | t"
            >
              <span
                class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-danger/20 flex items-center justify-center group-hover:bg-danger/40 transition-colors duration-150"
                aria-hidden="true"
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
              </span>
              <span class="text-xs sm:text-sm text-text-muted group-hover:text-text-secondary">
                {{ 'voip.decline' | t }}
              </span>
            </button>

            <button
              #acceptButton
              hlmBtn
              type="button"
              (click)="onAccept()"
              class="min-w-20 min-h-20 flex flex-col items-center justify-center gap-1.5 sm:gap-2 group disabled:opacity-60"
              [disabled]="actionPending()"
              [attr.aria-label]="'voip.accept' | t"
            >
              <span
                class="incoming-call-pulse w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-success/20 flex items-center justify-center group-hover:bg-success/40 transition-colors duration-150 animate-pulse"
                aria-hidden="true"
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
              </span>
              <span class="text-xs sm:text-sm text-success group-hover:text-success/80">
                {{ 'voip.accept' | t }}
              </span>
            </button>
          </div>
        </div>
      </div>
    }

    @if (safeCallData() && safeRingtoneUrl()) {
      <audio
        #ringtoneAudio
        [src]="safeRingtoneUrl()"
        loop
        autoplay
        class="hidden"
        (error)="onRingtoneError()"
      ></audio>
    }
  `,
  styles: [
    `
      .incoming-call-dialog {
        animation: incoming-call-enter 0.2s ease-out;
      }

      @keyframes incoming-call-enter {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .incoming-call-dialog,
        .incoming-call-pulse {
          animation: none !important;
          transition: none !important;
        }
      }
    `,
  ],
})
export class IncomingCallModalComponent {
  readonly callData = input<IncomingCallData | null>(null);

  /**
   * Optional trusted ringtone URL. When omitted or unavailable, the component
   * uses a short browser-generated ringtone pattern instead of depending on a
   * network asset.
   */
  readonly ringtoneUrl = input<string>('');

  readonly acceptCall = output<IncomingCallData>();
  readonly declineCall = output<IncomingCallData>();

  readonly safeCallData = computed(() => normaliseIncomingCallData(this.callData()));
  readonly safeRingtoneUrl = computed(() => this.normaliseRingtoneUrl(this.ringtoneUrl()));
  readonly actionPending = signal(false);

  private readonly ringtoneAudioRef = viewChild<ElementRef<HTMLAudioElement>>('ringtoneAudio');
  private readonly declineButtonRef = viewChild<ElementRef<HTMLButtonElement>>('declineButton');
  private readonly acceptButtonRef = viewChild<ElementRef<HTMLButtonElement>>('acceptButton');
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private activeCallKey: string | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private previousBodyOverflow: string | null = null;

  constructor() {
    effect(() => {
      const data = this.safeCallData();
      const ringtoneUrl = this.safeRingtoneUrl();

      if (!data) {
        this.closeModalEnvironment();
        return;
      }

      const callKey = `${data.callerId}:${data.roomName}`;
      if (this.activeCallKey !== callKey) {
        this.activeCallKey = callKey;
        this.actionPending.set(false);
        this.openModalEnvironment();
      }

      this.playRingtone(ringtoneUrl);
    });

    this.destroyRef.onDestroy(() => {
      this.closeModalEnvironment();
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleDocumentKeydown(event: KeyboardEvent): void {
    if (!this.safeCallData() || this.actionPending()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onDecline();
      return;
    }

    if (event.key !== 'Tab') return;

    const first = this.declineButtonRef()?.nativeElement;
    const last = this.acceptButtonRef()?.nativeElement;
    if (!first || !last) return;

    const active = this.document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onAccept(): void {
    this.emitOnce(this.acceptCall);
  }

  onDecline(): void {
    this.emitOnce(this.declineCall);
  }

  onRingtoneError(): void {
    if (!this.safeCallData() || !this.isBrowser) return;
    this.stopHtmlRingtone();
    this.playFallbackRingtone();
  }

  private emitOnce(emitter: { emit(value: IncomingCallData): void }): void {
    const data = this.safeCallData();
    if (!data || this.actionPending()) return;

    this.actionPending.set(true);
    this.stopRingtone();
    emitter.emit(data);
  }

  private openModalEnvironment(): void {
    if (!this.isBrowser) return;

    const activeElement = this.document.activeElement;
    this.previouslyFocused = activeElement instanceof HTMLElement ? activeElement : null;

    if (this.previousBodyOverflow === null) {
      this.previousBodyOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
    }

    queueMicrotask(() => {
      if (this.safeCallData() && !this.actionPending()) {
        this.declineButtonRef()?.nativeElement.focus();
      }
    });
  }

  private closeModalEnvironment(): void {
    this.stopRingtone();
    this.activeCallKey = null;
    this.actionPending.set(false);

    if (!this.isBrowser) return;

    if (this.previousBodyOverflow !== null) {
      this.document.body.style.overflow = this.previousBodyOverflow;
      this.previousBodyOverflow = null;
    }

    const previous = this.previouslyFocused;
    this.previouslyFocused = null;
    if (previous?.isConnected) {
      queueMicrotask(() => previous.focus());
    }
  }

  private playRingtone(url: string | null): void {
    if (!this.isBrowser) return;

    this.stopRingtone();

    if (!url) {
      this.playFallbackRingtone();
      return;
    }

    const audioEl = this.ringtoneAudioRef()?.nativeElement;
    if (!audioEl) {
      this.playFallbackRingtone();
      return;
    }

    audioEl.loop = true;
    audioEl.volume = 0.5;
    void audioEl.play().catch(() => {
      this.playFallbackRingtone();
    });
  }

  private playFallbackRingtone(): void {
    if (!this.isBrowser || this.audioContext) return;

    try {
      const browserWindow = this.document.defaultView;
      if (!browserWindow) return;

      const AudioContextClass = browserWindow.AudioContext
        ? browserWindow.AudioContext
        : hasWebkitAudioContext(browserWindow)
          ? browserWindow.webkitAudioContext
          : undefined;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0;
      oscillator.start();

      const pulse = (): void => {
        if (audioContext.state === 'closed') return;
        const now = audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.setValueAtTime(0, now + 0.25);
        gainNode.gain.setValueAtTime(0.18, now + 0.45);
        gainNode.gain.setValueAtTime(0, now + 0.7);
      };

      pulse();
      this.fallbackTimer = setInterval(pulse, 1800);
      this.audioContext = audioContext;
      this.oscillator = oscillator;
      this.gainNode = gainNode;
      void audioContext.resume().catch(() => undefined);
    } catch {
      this.stopFallbackRingtone();
    }
  }

  private stopHtmlRingtone(): void {
    const audioEl = this.ringtoneAudioRef()?.nativeElement;
    if (!audioEl) return;

    audioEl.pause();
    try {
      audioEl.currentTime = 0;
    } catch {
      // Some media implementations reject seeking before metadata is loaded.
    }
  }

  private stopFallbackRingtone(): void {
    if (this.fallbackTimer !== null) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch {
        // Already stopped.
      }
      this.oscillator.disconnect();
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    const audioContext = this.audioContext;
    this.audioContext = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined);
    }
  }

  private stopRingtone(): void {
    this.stopHtmlRingtone();
    this.stopFallbackRingtone();
  }

  private normaliseRingtoneUrl(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 2048) return null;

    if (trimmed.startsWith('/')) return trimmed;

    try {
      const url = new URL(trimmed);
      if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }
}
