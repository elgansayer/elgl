import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ExchangeTimerService } from '../../services/exchange-timer.service';

@Component({
  selector: 'app-exchange-timer',
  imports: [HlmButton, TranslatePipe],
  template: `
    @if (timer.isActive()) {
      <section
        class="rounded-lg border border-white/20 bg-surface-900/80 px-3 py-2 text-white shadow-lg"
        [attr.aria-label]="'video_call.exchange_timer_aria' | t"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-xs font-semibold sm:text-sm">
              {{
                (timer.isMyTurn()
                  ? 'video_call.exchange_your_turn'
                  : 'video_call.exchange_partner_turn'
                ) | t
              }}
            </p>
            <p class="text-[10px] text-white/60 sm:text-xs">
              {{
                (timer.isMyTurn()
                  ? 'video_call.exchange_speak_your_language'
                  : 'video_call.exchange_listen_and_wait'
                ) | t
              }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            @if (timer.currentSpeakerLanguage(); as language) {
              <span
                class="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs"
              >
                {{ language }}
              </span>
            }
            <span class="font-mono text-sm tabular-nums sm:text-base" aria-hidden="true">
              {{ formattedRemaining() }}
            </span>
          </div>
        </div>

        @if (timer.isMyTurn()) {
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="sm"
            class="mt-2 w-full"
            [attr.aria-label]="'video_call.exchange_end_turn_aria' | t"
            (click)="endTurn()"
          >
            {{ 'video_call.exchange_end_turn' | t }}
          </button>
        } @else {
          <p class="mt-2 text-[10px] text-white/60 sm:text-xs">
            {{ 'video_call.exchange_muted_until_turn' | t }}
          </p>
        }

        <p class="sr-only" role="status">
          {{
            (timer.isMyTurn()
              ? 'video_call.exchange_your_turn'
              : 'video_call.exchange_partner_turn'
            ) | t
          }}
          {{ timer.currentSpeakerLanguage() ?? '' }}
        </p>
      </section>
    }
  `,
})
export class ExchangeTimerComponent {
  readonly timer = inject(ExchangeTimerService);

  readonly formattedRemaining = computed(() => {
    const total = Math.max(0, this.timer.remainingSeconds());
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  });

  endTurn(): void {
    void this.timer.advanceTurn();
  }
}
