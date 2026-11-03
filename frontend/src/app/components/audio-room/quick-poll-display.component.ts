import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

export interface PollViewData {
  poll_id: string;
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
  is_active: boolean;
  userVote: number | null;
}

@Component({
  selector: 'app-quick-poll-display',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog state="open" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-sheet border border-surface-100 bg-surface-200 p-0 shadow-lift motion-reduce:animate-none"
      >
        <hlm-dialog-header class="border-b border-surface-100 p-5 text-start">
          <h2 hlmDialogTitle class="break-words text-lg font-bold text-text-primary">
            {{ data().question }}
          </h2>
          <p hlmDialogDescription class="text-sm text-text-secondary" aria-live="polite">
            {{ 'quickPoll.totalVotes' | t: { count: data().totalVotes } }}
          </p>
        </hlm-dialog-header>

        <div class="flex flex-col gap-4 p-5">
          @for (option of data().options; track option; let index = $index) {
            @let percentage = votePercentage(index);
            <section class="flex flex-col gap-2" [attr.aria-label]="option">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="min-w-0 break-words font-medium text-text-primary">{{ option }}</span>
                <span class="shrink-0 text-text-secondary">
                  {{ percentage }}% · {{ data().votes[index] }}
                </span>
              </div>
              <div
                class="h-3 overflow-hidden rounded-pill bg-surface-100"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="percentage"
                [attr.aria-label]="
                  'quickPoll.optionResult' | t: { option: option, count: data().votes[index] }
                "
              >
                <div
                  class="h-full rounded-pill bg-secondary transition-[width] motion-reduce:transition-none"
                  [style.width.%]="percentage"
                ></div>
              </div>

              @if (selectedOptionIndex() === index) {
                <p class="text-sm font-semibold text-secondary-ink">
                  {{ 'quickPoll.yourVote' | t }}
                </p>
              } @else if (allowVote()) {
                <button
                  hlmBtn
                  type="button"
                  variant="outline"
                  size="touch"
                  class="w-full"
                  (click)="vote.emit(index)"
                  [attr.aria-label]="'quickPoll.voteForOption' | t: { option: option }"
                >
                  {{ 'quickPoll.vote' | t }}
                </button>
              }
            </section>
          }
        </div>

        <hlm-dialog-footer class="border-t border-surface-100 p-5">
          <button
            hlmBtn
            hlmDialogClose
            type="button"
            variant="secondary"
            size="touch"
            class="w-full sm:w-auto"
          >
            {{ 'common.close' | t }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class QuickPollDisplayComponent {
  readonly data = input.required<PollViewData>();
  readonly allowVote = input(false);
  readonly selectedOptionIndex = input<number | null>(null);
  readonly vote = output<number>();
  readonly closed = output<void>();

  votePercentage(index: number): number {
    const total = this.data().totalVotes;
    if (total === 0) return 0;
    return Math.round((this.data().votes[index] / total) * 100);
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') this.closed.emit();
  }
}
