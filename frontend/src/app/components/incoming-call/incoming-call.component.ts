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

function isIncomingCallEvent(
  value: unknown,
): value is { type: string; callInfo: IncomingCallInfo } {
  if (typeof value !== 'object' || value === null) return false;
  if (!('type' in value) || !('callInfo' in value)) return false;
  return (
    typeof value.type === 'string' && typeof value.callInfo === 'object' && value.callInfo !== null
  );
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
                <span class="text-3xl sm:text-4xl">{{ 'voip.avatarPlaceholder' | t }}</span>
              }
            </div>
            <h2 class="text-lg sm:text-xl font-bold text-text-primary mb-1">
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
                <span>{{ 'voip.endToEndEncryptedIcon' | t }}</span>
                {{ 'voip.endToEndEncrypted' | t }}
              </p>
            }
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-4 sm:gap-6 pb-6 sm:pb-8 px-4 sm:px-6">
            <app-button-secondary
              size="lg"
              customClass="!rounded-full !w-14 !h-14 sm:!w-16 sm:!h-16 !p-0 !bg-danger !border-danger !text-on-fill hover:!bg-danger/90"
              (clicked)="rejectCall()"
            >
              <span class="text-xl sm:text-2xl">{{ 'voip.rejectIcon' | t }}</span>
            </app-button-secondary>

            <app-button-primary
              size="lg"
              customClass="!rounded-full !w-14 !h-14 sm:!w-16 sm:!h-16 !p-0 !bg-success hover:!bg-success/90"
              (clicked)="acceptCall()"
            >
              <span class="text-xl sm:text-2xl">{{ 'voip.acceptIcon' | t }}</span>
            </app-button-primary>
          </div>

          <!-- Ringing indicator -->
          <div class="text-center pb-4 sm:pb-6">
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

  private ringtoneAudio: HTMLAudioElement | null = null;
  private ringtoneUrl = '/assets/audio/ringtone.wav';

  private subscribedChannel: string | null = null;
  private currentUserSilenceUnknown = signal<boolean>(false);
  private fallbackAudioContext: AudioContext | null = null;

  constructor() {
    effect((onCleanup) => {
      const user = this.authService.currentUser();
      const _userId = user?.id;
      if (!_userId) return;

      // Unsubscribe previous subscription if user changed
      if (this.subscribedChannel) {
        this.centrifugoService.unsubscribe(this.subscribedChannel);
        this.subscribedChannel = null;
      }

      this.loadSilenceSetting(_userId);

      const channel = `user_${_userId}`;
      this.centrifugoService.subscribe(channel, (data: unknown) => {
        if (isIncomingCallEvent(data) && data.type === 'incoming_call' && data.callInfo) {
          this.handleIncomingCall(data.callInfo);
        }
      });
      this.subscribedChannel = channel;

      onCleanup(() => {
        if (this.subscribedChannel) {
          this.centrifugoService.unsubscribe(this.subscribedChannel);
          this.subscribedChannel = null;
        }
      });
    });
  }

  private async handleIncomingCall(info: IncomingCallInfo): Promise<void> {
    this.callInfo.set(info);
    this.showCallModal.set(true);
    const _userId = this.authService.currentUser()?.id;
    if (_userId) {
      await this.loadSilenceSetting(_userId);
    }
    if (this.currentUserSilenceUnknown()) {
      // reject automatically without ringing
      this.rejectCall();
      return;
    }
    this.playRingtone();
  }

  private playRingtone(): void {
    this.stopRingtone();

    try {
      this.ringtoneAudio = new Audio(this.ringtoneUrl);
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.5;
      this.ringtoneAudio.play().catch(() => {
        this.playFallbackRingtone();
      });
    } catch {
      this.playFallbackRingtone();
    }
  }

  private playFallbackRingtone(): void {
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
      // Silently fail if fallback also doesn't work
    }
  }

  private async loadSilenceSetting(_userId: string): Promise<void> {
    const profile = await this.userService.getMyProfile();
    if (profile) {
      this.currentUserSilenceUnknown.set(profile.silence_unknown_callers ?? false);
    }
  }

  private stopRingtone(): void {
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
    if (!info) return;

    this.stopRingtone();
    this.showCallModal.set(false);
    this.hapticFeedback.tap();

    try {
      // Join the LiveKit room with E2EE key if provided
      await this.livekitService.joinRoom(
        info.roomName,
        this.authService.currentUser()?.id || 'unknown',
        info.isVideo,
        info.e2eeKey,
      );

      // Notify caller that call was accepted
      this.centrifugoService.publish(`user_${info.callerId}`, {
        type: 'call_accepted',
        data: {
          userId: this.authService.currentUser()?.id,
          roomName: info.roomName,
        },
      });

      this.hapticFeedback.success();
      this.callAccepted.emit(info);
    } catch {
      // Re-show modal if join failed
      this.showCallModal.set(true);
    }

    this.callInfo.set(null);
  }

  rejectCall(): void {
    const info = this.callInfo();
    if (!info) return;

    this.stopRingtone();
    this.showCallModal.set(false);
    this.hapticFeedback.tap();

    // Notify the caller that the call was rejected
    this.centrifugoService.publish(`user_${info.callerId}`, {
      type: 'call_rejected',
      data: {
        userId: this.authService.currentUser()?.id,
        roomName: info.roomName,
      },
    });

    this.callRejected.emit(info);
    this.callInfo.set(null);
  }

  ngOnDestroy(): void {
    this.stopRingtone();
    if (this.subscribedChannel) {
      this.centrifugoService.unsubscribe(this.subscribedChannel);
      this.subscribedChannel = null;
    }
  }
}
