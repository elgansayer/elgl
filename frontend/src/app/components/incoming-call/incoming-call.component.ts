import { Component, inject, signal, effect, OnDestroy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { LivekitService } from '../../services/livekit.service';

export interface IncomingCallInfo {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  roomName: string;
  isVideo: boolean;
}

@Component({
  selector: 'app-incoming-call',
  standalone: true,
  imports: [
    CommonModule,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  template: `
    @if (showCallModal()) {
      <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-surface-200 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slide-up">
          <!-- Caller Info -->
          <div class="flex flex-col items-center pt-8 pb-6 px-6">
            <div class="w-20 h-20 rounded-full bg-surface-100 flex items-center justify-center text-3xl mb-4 overflow-hidden">
              @if (callInfo()?.callerAvatar) {
                <img [src]="callInfo()?.callerAvatar" alt="Caller avatar" class="w-full h-full object-cover" />
              } @else {
                <span class="text-4xl">👤</span>
              }
            </div>
            <h2 class="text-xl font-bold text-text-primary mb-1">
              {{ callInfo()?.callerName || i18n.translate('common.unknownCaller') }}
            </h2>
            <p class="text-sm text-text-secondary">
              {{ callInfo()?.isVideo ? i18n.translate('voip.incomingVideoCall') : i18n.translate('voip.incomingVoiceCall') }}
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-center gap-6 pb-8 px-6">
            <app-button-secondary
              size="lg"
              customClass="!rounded-full !w-16 !h-16 !p-0 !bg-red-500 !border-red-500 hover:!bg-red-600"
              (clicked)="rejectCall()"
            >
              <span class="text-2xl">📞</span>
            </app-button-secondary>

            <app-button-primary
              size="lg"
              customClass="!rounded-full !w-16 !h-16 !p-0 !bg-green-500 hover:!bg-green-600"
              (clicked)="acceptCall()"
            >
              <span class="text-2xl">🎥</span>
            </app-button-primary>
          </div>

          <!-- Ringing indicator -->
          <div class="text-center pb-6">
            <span class="text-xs text-text-muted animate-pulse">
              {{ i18n.translate('voip.ringing') }}
            </span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
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
  `]
})
export class IncomingCallComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  private centrifugoService = inject(CentrifugoService);
  private authService = inject(AuthService);
  private livekitService = inject(LivekitService);

  readonly callAccepted = output<IncomingCallInfo>();
  readonly callRejected = output<IncomingCallInfo>();

  readonly showCallModal = signal(false);
  readonly callInfo = signal<IncomingCallInfo | null>(null);

  private ringtoneAudio: HTMLAudioElement | null = null;
  private ringtoneUrl = '/assets/audio/ringtone.mp3';

  private unsubscribeCentrifugo: (() => void) | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      const userId = user?.id;
      if (!userId) return;

      this.centrifugoService.subscribe(`user_${userId}`, (data: unknown) => {
        const event = data as { type: string; callInfo: IncomingCallInfo };
        if (event.type === 'incoming_call' && event.callInfo) {
          this.handleIncomingCall(event.callInfo);
        }
      });
    });
  }

  private handleIncomingCall(info: IncomingCallInfo): void {
    this.callInfo.set(info);
    this.showCallModal.set(true);
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
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();
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

  private fallbackAudioContext: AudioContext | null = null;

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

    try {
      // Join the LiveKit room
      await this.livekitService.joinRoom(info.roomName, this.authService.currentUser()?.id || 'unknown', info.isVideo);

      // Notify caller that call was accepted
      this.centrifugoService.publish(`user_${info.callerId}`, {
        type: 'call_accepted',
        data: {
          userId: this.authService.currentUser()?.id,
          roomName: info.roomName,
        },
      });

      this.callAccepted.emit(info);
    } catch (error) {
      console.error('Failed to accept call:', error);
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
    if (this.unsubscribeCentrifugo) {
      this.unsubscribeCentrifugo();
      this.unsubscribeCentrifugo = null;
    }
  }
}
