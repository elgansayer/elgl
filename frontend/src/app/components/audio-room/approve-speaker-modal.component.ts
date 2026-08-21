import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-approve-speaker-modal',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      (click)="dismiss.emit()"
      (keydown)="dismiss.emit()"
      tabindex="0"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-speaker-title"
        class="bg-surface-300 border border-surface-100 w-full max-w-md rounded-2xl p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
        (keydown.escape)="dismiss.emit()"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 id="approve-speaker-title" class="text-xl font-bold text-text-primary">
            {{ 'audioRoom.approveSpeakerModalTitle' | t }}
          </h2>
          <button
            hlmBtn
            class="text-text-secondary hover:text-text-primary transition-colors"
            [attr.aria-label]="'common.close' | t"
            (click)="dismiss.emit()"
          >
            ✕
          </button>
        </div>

        <p class="text-sm text-text-secondary mb-4">
          {{ 'audioRoom.approveSpeakerModalDesc' | t: { count: raisedHandUserIds().length } }}
        </p>

        <div class="max-h-80 overflow-y-auto pe-2 space-y-2">
          @for (userId of raisedHandUserIds(); track userId) {
            <div
              class="flex items-center justify-between rounded-xl border border-warning/20 bg-warning/5 p-4 hover:bg-warning/10 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-warning/20 border border-warning/40 flex items-center justify-center text-sm font-bold text-warning shrink-0"
                >
                  {{ userId.slice(0, 1).toUpperCase() }}
                </div>
                <div>
                  <div class="font-bold text-text-primary text-sm">
                    {{ 'audioRoom.learnerAccess' | t: { id: userId.slice(0, 8) } }}
                  </div>
                  <div class="text-xs text-text-secondary">
                    {{ 'audioRoom.wantsStageAccess' | t }}
                  </div>
                </div>
              </div>
              <button
                hlmBtn
                (click)="approve.emit(userId)"
                class="rounded-xl bg-success ps-4 pe-4 pt-2 pb-2 text-xs font-bold text-on-fill hover:bg-success/80 transition-colors shrink-0"
              >
                {{ 'audioRoom.approveSpeakerBtn' | t }}
              </button>
            </div>
          } @empty {
            <div class="text-center text-text-muted py-6 font-medium">
              {{ 'audioRoom.noRaisedHands' | t }}
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ApproveSpeakerModalComponent {
  raisedHandUserIds = input<string[]>([]);
  approve = output<string>();
  dismiss = output<void>();
}
