import { Component, inject, signal, effect, OnDestroy, output } from '@angular/core';

import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { LivekitService } from '../../services/livekit.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

export interface IncomingCallInfo {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  roomName: string;
  isVideo: boolean;
  e2eeKey?: string;
}

const SAFE_CHANNEL_TOKEN = /^[A-Za-z0-9_.:-]+$/;
const MAX_CALLER_ID_LENGTH = 128;
const MAX_ROOM_NAME_LENGTH = 256;
const MAX_CALLER_NAME_LENGTH = 100;
const MAX_AVATAR_URL_LENGTH = 2048;
const MAX_E2EE_KEY_LENGTH = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseBoundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalised = value.trim();
  if (normalised.length === 0 || normalised.length > maxLength) return null;
  if (/\p{Cc}/u.test(normalised)) return null;
  return normalised;
}

function normaliseChannelToken(value: unknown, maxLength: number): string | null {
  const token = normaliseBoundedString(value, maxLength);
  return token && SAFE_CHANNEL_TOKEN.test(token) ? token : null;
}

function normaliseAvatarUrl(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = normaliseBoundedString(value, MAX_AVATAR_URL_LENGTH);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parseIncomingCallEvent(value: unknown): IncomingCallInfo | null {
  if (!isRecord(value) || value['type'] !== 'incoming_call' || !isRecord(value['callInfo'])) {
    return null;
  }

  const raw = value['callInfo'];
  const callerId = normaliseChannelToken(raw['callerId'], MAX_CALLER_ID_LENGTH);
  const callerName = normaliseBoundedString(raw['callerName'], MAX_CALLER_NAME_LENGTH);
  const roomName = normaliseChannelToken(raw['roomName'], MAX_ROOM_NAME_LENGTH);
  const callerAvatar = normaliseAvatarUrl(raw['callerAvatar']);

  if (!callerId || !callerName || !roomName || callerAvatar === null) return null;
  if (typeof raw['isVideo'] !== 'boolean') return null;

  let e2eeKey: string | undefined;
  if (raw['e2eeKey'] !== undefined && raw['e2eeKey'] !== null && raw['e2eeKey'] !== '') {
    const normalisedKey = normaliseBoundedString(raw['e2eeKey'], MAX_E2EE_KEY_LENGTH);
    if (!normalisedKey) return null;
    e2eeKey = normalisedKey;
  }

  return {
    callerId,
    callerName,
    roomName,
    isVideo: raw['isVideo'],
    ...(callerAvatar ? { callerAvatar } : {}),
    ...(e2eeKey ? { e2eeKey } : {}),
  };
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
  selector: 'app-incoming-call',
  imports: [AppButtonPrimaryComponent, AppButtonSecondaryComponent, TranslatePipe],
  template: `
    @if (showCallModal()) {
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4"
      >
        <div
          class="bg-surface-200 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up"
          role="dialog"
          aria-modal="true"
          [attr.aria-busy]="callActionPending()"
        >
          <!-- Caller Info -->
          <div class="flex flex-col items-center pt-6 sm:pt-8 pb-4 sm:pb-6 px-4 sm:px-6">
            <div
              class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-100 flex items-center justify-center text-2xl sm:text-3xl mb-3 sm:mb-4 overflow-hidden"
            >
              @if (callInfo()?.callerAvatar) {
                <img
                  [src]="callInfo()?.callerAvatar"
                  [alt]="'voip.callerAvatar' | t"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              } @else {
                <span class="text-3xl sm:text-4xl" aria-hidden="true">{{
                  'voip.avatarPlaceholder' | t
                }}</span>
              }
            </div>
            <h2 class="text-lg sm:text-xl font-bold text-text-primary mb-1" dir="auto">
              {{ callInfo()?.callerName || ('common.unknownCaller' | t) }}
            </h2>
            <p class="text-xs sm:text-sm text-text-secondary">
              {{
                callInfo()?.isVideo
                  ? ('voip.incomingVideoCall' | t)
                  : ('voip.incomingVoiceCall' | t)
              }}
            </p>
            @if (callInfo()?.e2eeKey) {
              <p class="text-xs text-success mt-2 flex items-center gap-1">
                <span aria-hidden="true">{{ 'voip.endToEndEncryptedIcon' | t }}</span>
                {{ 'voip.endToEndEncrypted' | t }}
              </p>
            }
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-4 sm:gap-6 pb-6 sm:pb-8 px-4 sm:px-6">
            <app-button-secondary
              size="lg"
              [disabled]="callActionPending()"
              customClass="!rounded-full !w-14 !h-14 sm:!w-16 sm:!h-16 !p-0 !bg-danger !border-danger !text-on-fill hover:!bg-danger/90"
              (clicked)="rejectCall()"
            >
              <span class="text-xl sm:text-2xl" aria-hidden="true">{{ 'voip.rejectIcon' | t }}</span>
              <span class="sr-only">{{ 'voip.decline' | t }}</span>
            </app-button-secondary>

            <app-button-primary
              size="lg"
              [disabled]="callActionPending()"
              customClass="!rounded-full !w-14 !h-14 sm:!w-16 sm:!h-16 !p-0 !bg-success hover:!bg-success/90"
              (clicked)="acceptCall()"
            >
              <span class="text-xl sm:text-2xl" aria-hidden="true">{{ 'voip.acceptIcon' | t }}</span>
              <span class="sr-only">{{ 'voip.accept' | t }}</span>
            </app-button-primary>
          </div>

          <!-- Ringing indicator -->
          <div class="text-center pb-4 sm:pb-6" aria-live="polite">
            <span class="text-xs text-text-muted animate-pulse">
              {{ 'voip.ringing' | t }}
            </span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @keyframes slide-up {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .animate-slide-up {
        animation: slide-up 0.3s ease-out;
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-slide-up,
        .animate-pulse {
          animation: none;
        }
      }
    `,
  ],
})
export class IncomingCallComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  private centrifugoService = inject(CentrifugoService);
  private authService = inject(AuthService);
  private livekitService = inject(LivekitService);
  private userService = inject(UserService);
  private hapticFeedback = inject(HapticFeedbackService);

  readonly callAccepted = output<IncomingCallInfo>();
  readonly callRejected = output<IncomingCallInfo>();

  readonly showCallModal = signal(false);
  readonly callInfo = signal<IncomingCallInfo | null>(null);
  readonly callActionPending = signal(false);

  private ringtoneAudio: HTMLAudioElement | null = null;
  private readonly ringtoneUrl = '/assets/audio/ringtone.wav';

  private subscribedChannel: string | null = null;
  private currentUserSilenceUnknown = signal<boolean>(false);
  private fallbackAudioContext: AudioContext | null = null;
  private ringtoneGeneration = 0;

  constructor() {
    effect((onCleanup) => {
      const user = this.authService.currentUser();
      const userId = user?.id;
      if (!userId) {
        this.dismissCurrentCall();
        return;
      }

      if (this.subscribedChannel) {
        this.centrifugoService.unsubscribe(this.subscribedChannel);
        this.subscribedChannel = null;
      }

      void this.loadSilenceSetting();

      const channel = `user_${userId}`;
      this.centrifugoService.subscribe(channel, (data: unknown) => {
        const info = parseIncomingCallEvent(data);
        if (info) void this.handleIncomingCall(info);
      });
      this.subscribedChannel = channel;

      onCleanup(() => {
        if (this.subscribedChannel === channel) {
          this.centrifugoService.unsubscribe(channel);
          this.subscribedChannel = null;
        }
      });
    });
  }

  private async handleIncomingCall(info: IncomingCallInfo): Promise<void> {
    // A second realtime delivery must not replace a call the user is already deciding on.
    if (this.callInfo() || this.callActionPending()) return;

    this.callInfo.set(info);
    this.showCallModal.set(true);

    const silenceUnknown = await this.loadSilenceSetting();
    if (this.callInfo() !== info || !this.showCallModal()) return;

    if (silenceUnknown === true) {
      this.rejectCall();
      return;
    }

    // If the privacy preference cannot be loaded, keep the visual controls available but
    // fail silent rather than unexpectedly playing a ringtone.
    if (silenceUnknown === null) return;

    this.playRingtone();
  }

  private playRingtone(): void {
    this.stopRingtone();
    const generation = this.ringtoneGeneration;

    try {
      this.ringtoneAudio = new Audio(this.ringtoneUrl);
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.5;
      this.ringtoneAudio.play().catch(() => {
        this.playFallbackRingtone(generation);
      });
    } catch {
      this.playFallbackRingtone(generation);
    }
  }

  private playFallbackRingtone(generation: number): void {
    if (generation !== this.ringtoneGeneration || !this.showCallModal()) return;

    try {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const now = audioContext.currentTime;
      for (let i = 0; i < 10; i++) {
        const startTime = now + i * 0.5;
        const endTime = startTime + 0.3;
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.setValueAtTime(0, endTime);
      }

      oscillator.start(now);
      oscillator.stop(now + 5);

      this.fallbackAudioContext = audioContext;
    } catch {
      // Browsers may block all programmatic audio. The visual call controls remain available.
    }
  }

  private async loadSilenceSetting(): Promise<boolean | null> {
    try {
      const profile = await this.userService.getMyProfile();
      if (!profile) return null;
      const shouldSilence = profile.silence_unknown_callers ?? false;
      this.currentUserSilenceUnknown.set(shouldSilence);
      return shouldSilence;
    } catch {
      return null;
    }
  }

  private stopRingtone(): void {
    this.ringtoneGeneration += 1;

    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio = null;
    }

    if (this.fallbackAudioContext) {
      this.fallbackAudioContext.close().catch(() => {});
      this.fallbackAudioContext = null;
    }
  }

  async acceptCall(): Promise<void> {
    const info = this.callInfo();
    const userId = this.authService.currentUser()?.id;
    if (!info || !userId || this.callActionPending()) {
      if (info && !userId) this.hapticFeedback.error();
      return;
    }

    this.callActionPending.set(true);
    this.stopRingtone();
    this.hapticFeedback.tap();

    try {
      await this.livekitService.joinRoom(info.roomName, userId, info.isVideo, info.e2eeKey);

      this.showCallModal.set(false);
      this.callInfo.set(null);

      this.centrifugoService.publish(`user_${info.callerId}`, {
        type: 'call_accepted',
        data: {
          userId,
          roomName: info.roomName,
        },
      });

      this.hapticFeedback.success();
      this.callAccepted.emit(info);
    } catch {
      // Preserve the call so the user can retry accepting after a transient LiveKit failure.
      this.showCallModal.set(true);
      this.hapticFeedback.error();
    } finally {
      this.callActionPending.set(false);
    }
  }

  rejectCall(): void {
    const info = this.callInfo();
    if (!info || this.callActionPending()) return;

    this.callActionPending.set(true);
    this.stopRingtone();
    this.showCallModal.set(false);
    this.hapticFeedback.tap();

    const userId = this.authService.currentUser()?.id;
    if (userId) {
      this.centrifugoService.publish(`user_${info.callerId}`, {
        type: 'call_rejected',
        data: {
          userId,
          roomName: info.roomName,
        },
      });
    }

    this.callRejected.emit(info);
    this.callInfo.set(null);
    this.callActionPending.set(false);
  }

  private dismissCurrentCall(): void {
    this.stopRingtone();
    this.showCallModal.set(false);
    this.callInfo.set(null);
    this.callActionPending.set(false);
  }

  ngOnDestroy(): void {
    this.dismissCurrentCall();
    if (this.subscribedChannel) {
      this.centrifugoService.unsubscribe(this.subscribedChannel);
      this.subscribedChannel = null;
    }
  }
}
