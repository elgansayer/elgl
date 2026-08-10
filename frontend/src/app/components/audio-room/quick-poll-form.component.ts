import { Component, signal, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-quick-poll-form',
  imports: [TranslatePipe, FormsModule],
  template: `
    <div class="bg-surface p-4 rounded-xl shadow-lg">
      <h3 class="text-lg font-semibold mb-3">{{ 'quickPoll.title' | t }}</h3>
      <input
        [(ngModel)]="question"
        class="w-full p-2 rounded bg-surface-2 border-s border-surface-4 mb-2"
        placeholder="{{ 'quickPoll.questionPlaceholder' | t }}"
      />
      @for (opt of options(); track $index) {
        <div class="flex items-center gap-2 mb-1">
          <input
            [(ngModel)]="options()[$index]"
            class="flex-1 p-2 rounded bg-surface-2 border-s border-surface-4"
            [placeholder]="'quickPoll.optionPlaceholder' | t: { n: $index + 1 }"
          />
          @if (options().length > 2) {
            <button (click)="removeOption($index)" class="text-red-400 text-sm">
              {{ 'quickPoll.removeOption' | t }}
            </button>
          }
        </div>
      }
      <button (click)="addOption()" class="text-blue-400 text-sm mb-3">
        {{ 'quickPoll.addOption' | t }}
      </button>
      <div class="flex justify-end gap-2">
        <button (click)="cancelled.emit()" class="px-4 py-2 rounded bg-surface-4">
          {{ 'common.cancel' | t }}
        </button>
        <button (click)="submit()" class="px-4 py-2 rounded bg-primary text-on-primary">
          {{ 'quickPoll.submitPoll' | t }}
        </button>
      </div>
    </div>
  `,
})
export class QuickPollFormComponent {
  readonly question = signal('');
  readonly options = signal(['', '']);
  readonly submitPoll = output<{ question: string; options: string[] }>();
  readonly cancelled = output<void>();

  addOption(): void {
    this.options.update((list) => [...list, '']);
  }

  removeOption(index: number): void {
    this.options.update((list) => list.filter((_, i) => i !== index));
  }

  submit(): void {
    const q = this.question().trim();
    const opts = this.options()
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (!q || opts.length < 2) return;
    this.submitPoll.emit({ question: q, options: opts });
  }
}
