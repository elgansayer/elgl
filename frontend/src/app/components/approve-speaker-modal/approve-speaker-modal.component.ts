import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-approve-speaker-modal',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        class="w-full max-w-md bg-[#121212] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 class="text-xl font-bold text-slate-100">{{ 'approveSpeaker.modalTitle' | t }}</h2>
          <button
            (click)="closed.emit()"
            class="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 flex flex-col gap-4">
          @if (raisedHands().length === 0) {
            <div class="text-center py-8 opacity-70">
              <p class="text-slate-400 text-sm">{{ 'approveSpeaker.emptyRequests' | t }}</p>
            </div>
          } @else {
            <p class="text-sm text-slate-400">
              {{ 'approveSpeaker.subtitle' | t: { count: raisedHands().length } }}
            </p>
            @for (requestId of raisedHands(); track requestId) {
              <div
                class="flex items-center justify-between rounded-xl border border-amber-500/30 bg-slate-800/50 p-4"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">✋</span>
                  <div>
                    <p class="font-semibold text-slate-100 text-sm">
                      {{ 'approveSpeaker.learnerLabel' | t: { id: requestId.slice(0, 8) } }}
                    </p>
                    <p class="text-xs text-slate-400">
                      {{ 'approveSpeaker.learnerDesc' | t }}
                    </p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button
                    (click)="approved.emit(requestId)"
                    class="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors"
                  >
                    {{ 'approveSpeaker.approveAction' | t }}
                  </button>
                  <button
                    (click)="declined.emit(requestId)"
                    class="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-bold text-slate-300 transition-colors"
                  >
                    {{ 'approveSpeaker.declineAction' | t }}
                  </button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
          <button
            (click)="closed.emit()"
            class="px-5 py-2.5 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {{ 'approveSpeaker.doneBtn' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ApproveSpeakerModalComponent {
  readonly raisedHands = input<string[]>([], { alias: 'raisedHands' });
  readonly approved = output<string>();
  readonly declined = output<string>();
  readonly closed = output<void>();
}