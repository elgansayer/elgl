import { Component, input, output, computed, signal, effect, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService, CentrifugoEvent } from '../../services/centrifugo.service';

export type CallState = 'connecting' | 'ringing' | 'connected' | 'ended';

@Component({
  selector: 'app-voip-call',
  standalone: true,
  imports: [AppButtonPrimaryComponent, AppButtonSecondaryComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" 
         [attr.dir]="i18nService.currentLang() | rtlDir">
      <div class="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-slate-700">
        <!-- Call Header -->
        <div class="ps-6 pe-6 pt-8 pb-4 text-center">
          <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4">
            {{ callerName() | slice:0:1 | uppercase }}
          </div>
          <h2 class="text-xl font-bold text-white mb-1">{{ callerName() }}</h2>
          <p class="text-sm text-slate-400">{{ callStatusText() }}</p>
          @if (callDuration()) {
            <p class="text-xs text-slate-500 mt-1">{{ callDuration() }}</p>
          }
        </div>

        <!-- Call Controls -->
        <div class="ps-6 pe-6 pb-8 pt-2">
          <div class="flex justify-center gap-6">
            <!-- Mute Button -->
            <div class="flex flex-col items-center gap-2">
              <app-button-secondary
                [size]="'lg'"
                [customClass]="muted() ? '!bg-red-500 !text-white !border-red-400 !hover:bg-red-600' : '!bg-slate-800 !text-slate-300 !border-slate-700 !hover:bg-slate-700'"
                (clicked)="toggleMute()"
              >
                @if (muted()) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                }
              </app-button-secondary>
              <span class="text-xs text-slate-500">{{ i18nService.translate('voip.mute') }}</span>
            </div>

            <!-- Speakerphone Button -->
            <div class="flex flex-col items-center gap-2">
              <app-button-secondary
                [size]="'lg'"
                [customClass]="speakerOn() ? '!bg-primary !text-white !border-primary !hover:bg-primary/90' : '!bg-slate-800 !text-slate-300 !border-slate-700 !hover:bg-slate-700'"
                (clicked)="toggleSpeaker()"
              >
                @if (speakerOn()) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
              </app-button-secondary>
              <span class="text-xs text-slate-500">{{ i18nService.translate('voip.speaker') }}</span>
            </div>

            <!-- End Call Button -->
            <div class="flex flex-col items-center gap-2">
              <app-button-primary
                [size]="'lg'"
                [customClass]="'!bg-red-600 !text-white !border-red-500 !hover:bg-red-700 !rounded-full !w-14 !h-14 !p-0'"
                (clicked)="endCall()"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </app-button-primary>
              <span class="text-xs text-red-400 font-semibold">{{ i18nService.translate('voip.endCall') }}</span>
            </div>
          </div>
        </div>

        <!-- Call Ended State -->
        @if (callState() === 'ended') {
          <div class="ps-6 pe-6 pb-6 text-center">
            <p class="text-slate-400 text-sm mb-4">{{ i18nService.translate('voip.callEnded') }}</p>
            <app-button-primary
              [size]="'md'"
              (clicked)="dismiss.emit()"
            >
              {{ i18nService.translate('voip.dismiss') }}
            </app-button-primary>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class VoipCallComponent {
  readonly i18nService = inject(I18nService);
  private centrifugoService = inject(CentrifugoService);
  private destroyRef = inject(DestroyRef);

  // Inputs
  readonly callerName = input.required<string>();
  readonly callerId = input.required<string>();
  readonly roomId = input.required<string>();
  readonly callState = input<CallState>('connecting');

  // Outputs
  readonly muteToggled = output<boolean>();
  readonly speakerToggled = output<boolean>();
  readonly callEnded = output<void>();
  readonly dismiss = output<void>();

  // Internal state
  readonly muted = signal(false);
  readonly speakerOn = signal(false);
  readonly callDuration = signal<string>('');
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private callStartTime: number | null = null;

  constructor() {
    // Listen for call state changes to start/stop duration timer
    effect(() => {
      const state = this.callState();
      if (state === 'connected' && !this.callStartTime) {
        this.callStartTime = Date.now();
        this.startDurationTimer();
      } else if (state === 'ended') {
        this.stopDurationTimer();
      }
    });

    // Listen for remote mute/unmute events via Centrifugo
    this.centrifugoService.events.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: CentrifugoEvent) => {
      if (event.channel === `room_${this.roomId()}`) {
        const data = event.data as Record<string, unknown>;
        if (data?.type === 'remote_mute') {
          this.muted.set(true);
        } else if (data?.type === 'remote_unmute') {
          this.muted.set(false);
        }
      }
    });
  }

  private startDurationTimer(): void {
    this.durationInterval = setInterval(() => {
      if (this.callStartTime) {
        const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        this.callDuration.set(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  toggleMute(): void {
    const newMuted = !this.muted();
    this.muted.set(newMuted);
    this.muteToggled.emit(newMuted);

    // Publish mute state to room channel for remote participants
    this.centrifugoService.publish(`room_${this.roomId()}`, {
      type: newMuted ? 'remote_mute' : 'remote_unmute',
      userId: this.callerId(),
    });
  }

  toggleSpeaker(): void {
    const newSpeaker = !this.speakerOn();
    this.speakerOn.set(newSpeaker);
    this.speakerToggled.emit(newSpeaker);
  }

  endCall(): void {
    this.stopDurationTimer();
    this.callEnded.emit();
  }

  get callStatusText(): string {
    const state = this.callState();
    switch (state) {
      case 'connecting':
        return this.i18nService.translate('voip.connecting');
      case 'ringing':
        return this.i18nService.translate('voip.ringing');
      case 'connected':
        return this.i18nService.translate('voip.connected');
      case 'ended':
        return this.i18nService.translate('voip.callEnded');
      default:
        return '';
    }
  }
}
