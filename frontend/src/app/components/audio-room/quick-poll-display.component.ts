import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

export interface PollViewData {
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
}

@Component({
  selector: 'app-quick-poll-display',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="bg-surface p-4 rounded-xl shadow-lg">
      <h4 class="font-semibold mb-3">{{ data().question }}</h4>
      @for (opt of data().options; track $index; let idx = $index) {
        <div class="flex items-center gap-2 mb-2">
          <div class="flex-1 bg-surface-2 rounded-full h-6 relative overflow-hidden">
            @let widthPct = data().totalVotes ? (data().votes[idx] / data().totalVotes) * 100 : 0;
            <div
              class="absolute inset-y-0 start-0 bg-accent rounded-full transition-all"
              [style.width.%]="widthPct"
            ></div>
            <span class="relative z-10 ps-2 text-sm leading-6">{{ opt }}</span>
            <span class="relative z-10 pe-2 text-sm leading-6 float-end">{{
              data().votes[idx]
            }}</span>
          </div>
          @if (allowVote()) {
            <button
              hlmBtn
              (click)="vote.emit(idx)"
              class="px-3 py-1 rounded bg-primary text-on-primary text-xs"
            >
              {{ 'quickPoll.vote' | t }}
            </button>
          }
        </div>
      }
      <p class="text-xs text-surface-5 mt-2">
        {{ 'quickPoll.totalVotes' | t: { count: data().totalVotes } }}
      </p>
    </div>
  `,
})
export class QuickPollDisplayComponent {
  readonly data = input.required<PollViewData>();
  readonly allowVote = input(false);
  readonly vote = output<number>();
}
