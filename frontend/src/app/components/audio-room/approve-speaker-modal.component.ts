import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-approve-speaker-modal',
  imports: [TranslatePipe],
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
        class="bg-[#121212] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
        (keydown.escape)="dismiss.emit()"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 id="approve-speaker-title" class="text-xl font-bold text-slate-100">
            {{ 'audioRoom.approveSpeakerModalTitle' | t }}
          </h2>
          <button
            class="text-slate-400 hover:text-white transition-colors"
            [attr.aria-label]="'common.close' | t"
            (click)="dismiss.emit()"
          >
            ✕
          </button>
        </div>

        <p class="text-sm text-slate-400 mb-4">
          {{ 'audioRoom.approveSpeakerModalDesc' | t: { count: raisedHandUserIds().length } }}
        </p>

        <div class="max-h-80 overflow-y-auto pe-2 space-y-2">
          @for (userId of raisedHandUserIds(); track userId) {
            <div
              class="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 hover:bg-amber-500/10 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-sm font-bold text-amber-300 shrink-0"
                >
                  {{ userId.slice(0, 1).toUpperCase() }}
                </div>
                <div>
                  <div class="font-bold text-slate-200 text-sm">
                    {{ 'audioRoom.learnerAccess' | t: { id: userId.slice(0, 8) } }}
                  </div>
                  <div class="text-xs text-slate-400">
                    {{ 'audioRoom.wantsStageAccess' | t }}
                  </div>
                </div>
              </div>
              <button
                (click)="approve.emit(userId)"
                class="rounded-xl bg-emerald-600 ps-4 pe-4 pt-2 pb-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shrink-0"
              >
                {{ 'audioRoom.approveSpeakerBtn' | t }}
              </button>
            </div>
          } @empty {
            <div class="text-center text-slate-500 py-6 font-medium">
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
