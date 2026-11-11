import { Component, computed, inject, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CallAudioSessionService } from '../../services/call-audio-session.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface DeviceNoticeMessage {
  readonly key: string;
  readonly params: Record<string, string> | undefined;
}

/**
 * Tells the person on a call when sound or the microphone stopped working and gives them the
 * one action that fixes it. Rendered once in the app shell so every call and room surface gets
 * it. Blocked sound and a dead microphone are announced as alerts because the call is unusable
 * until they are fixed. A change of device is a polite status update.
 */
@Component({
  selector: 'app-call-audio-status',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 top-10 z-[10000] flex flex-col items-center gap-2 px-4"
    >
      <div role="alert" class="pointer-events-auto w-full max-w-xl">
        @if (playbackBlocked()) {
          <div
            data-testid="call-audio-playback-blocked"
            class="flex flex-wrap items-center gap-3 rounded-card border border-warning bg-surface-200 px-4 py-3 text-sm font-semibold text-text-primary shadow-lift"
          >
            <p class="min-w-0 flex-1" dir="auto">{{ 'callAudio.playbackBlocked' | t }}</p>
            <button hlmBtn type="button" size="touch" (click)="resumePlayback()">
              {{ 'callAudio.playbackResume' | t }}
            </button>
          </div>
        } @else if (microphoneInterrupted()) {
          <div
            data-testid="call-audio-microphone-interrupted"
            class="flex flex-wrap items-center gap-3 rounded-card border border-warning bg-surface-200 px-4 py-3 text-sm font-semibold text-text-primary shadow-lift"
          >
            <p class="min-w-0 flex-1" dir="auto">{{ 'callAudio.microphoneInterrupted' | t }}</p>
            <button
              hlmBtn
              type="button"
              size="touch"
              [disabled]="reconnecting()"
              [attr.aria-busy]="reconnecting() ? 'true' : null"
              (click)="reconnectMicrophone()"
            >
              {{ 'callAudio.microphoneReconnect' | t }}
            </button>
            <button hlmBtn type="button" size="touch" variant="ghost" (click)="dismissMicrophone()">
              {{ 'callAudio.dismiss' | t }}
            </button>
          </div>
        }
      </div>
      <div role="status" class="pointer-events-auto w-full max-w-xl">
        @if (deviceNoticeMessage(); as message) {
          <div
            data-testid="call-audio-device-notice"
            class="flex flex-wrap items-center gap-3 rounded-card border border-surface-100 bg-surface-200 px-4 py-3 text-sm font-semibold text-text-primary shadow-lift"
          >
            <p class="min-w-0 flex-1" dir="auto">{{ message.key | t: message.params }}</p>
            <button hlmBtn type="button" size="touch" variant="ghost" (click)="dismissDevice()">
              {{ 'callAudio.dismiss' | t }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class CallAudioStatusComponent {
  private readonly audioSession = inject(CallAudioSessionService);

  readonly playbackBlocked = this.audioSession.playbackBlocked;
  readonly microphoneInterrupted = this.audioSession.microphoneInterrupted;
  readonly reconnecting = signal(false);

  readonly deviceNoticeMessage = computed<DeviceNoticeMessage | null>(() => {
    const notice = this.audioSession.deviceNotice();
    if (!notice) {
      return null;
    }
    const isInput = notice.kind === 'audioinput';
    if (notice.label) {
      return {
        key: isInput ? 'callAudio.inputChanged' : 'callAudio.outputChanged',
        params: { device: notice.label },
      };
    }
    return {
      key: isInput ? 'callAudio.inputChangedDefault' : 'callAudio.outputChangedDefault',
      params: undefined,
    };
  });

  resumePlayback(): void {
    void this.audioSession.resumePlayback();
  }

  async reconnectMicrophone(): Promise<void> {
    if (this.reconnecting()) {
      return;
    }
    this.reconnecting.set(true);
    try {
      await this.audioSession.recoverMicrophone();
    } finally {
      this.reconnecting.set(false);
    }
  }

  dismissMicrophone(): void {
    this.audioSession.dismissMicrophoneNotice();
  }

  dismissDevice(): void {
    this.audioSession.dismissDeviceNotice();
  }
}
