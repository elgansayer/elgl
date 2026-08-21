import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-approve-speaker-modal',
  standalone: true,
  imports: [HlmButton, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        class="w-full max-w-md bg-surface-200 border border-surface-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
          <h2 class="text-xl font-bold text-text-primary">{{ 'approveSpeaker.modalTitle' | t }}</h2>
          <button
            hlmBtn
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-primary transition-colors p-2 rounded-full hover:bg-surface-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 flex flex-col gap-4">
          @if (raisedHands().length === 0) {
            <div class="text-center py-8 opacity-70">
              <p class="text-text-secondary text-sm">{{ 'approveSpeaker.emptyRequests' | t }}</p>
            </div>
          } @else {
            <p class="text-sm text-text-secondary">
              {{ 'approveSpeaker.subtitle' | t: { count: raisedHands().length } }}
            </p>
            @for (requestId of raisedHands(); track requestId) {
              <div
                class="flex items-center justify-between rounded-xl border border-warning/30 bg-surface-100/50 p-4"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">✋</span>
                  <div>
                    <p class="font-semibold text-text-primary text-sm">
                      {{ 'approveSpeaker.learnerLabel' | t: { id: requestId.slice(0, 8) } }}
                    </p>
                    <p class="text-xs text-text-secondary">
                      {{ 'approveSpeaker.learnerDesc' | t }}
                    </p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button
                    hlmBtn
                    (click)="approved.emit(requestId)"
                    class="rounded-lg bg-success hover:bg-success/90 px-4 py-2 text-sm font-bold text-on-fill transition-colors"
                  >
                    {{ 'approveSpeaker.approveAction' | t }}
                  </button>
                  <button
                    hlmBtn
                    (click)="declined.emit(requestId)"
                    class="rounded-lg bg-surface-100 hover:bg-surface-50 px-4 py-2 text-sm font-bold text-text-secondary transition-colors"
                  >
                    {{ 'approveSpeaker.declineAction' | t }}
                  </button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-surface-100 flex justify-end gap-3 bg-surface-100/50">
          <button
            hlmBtn
            (click)="closed.emit()"
            class="px-5 py-2.5 rounded-xl font-bold text-text-secondary hover:bg-surface-100 transition-colors"
          >
            {{ 'approveSpeaker.doneBtn' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ApproveSpeakerModalComponent {
  readonly raisedHands = input<string[]>([]);
  readonly approved = output<string>();
  readonly declined = output<string>();
  readonly closed = output<void>();
}
