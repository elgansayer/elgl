import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, signal, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-quick-poll-form',
  imports: [HlmInput, HlmButton, TranslatePipe, FormsModule],
  template: `
    <div class="bg-surface-300 p-4 rounded-xl shadow-lg">
      <h3 class="text-lg font-semibold mb-3 text-text-primary">{{ 'quickPoll.title' | t }}</h3>
      <input
        hlmInput
        [(ngModel)]="question"
        class="w-full p-2 rounded bg-surface-200 border-s border-surface-100 mb-2 text-text-primary"
        placeholder="{{ 'quickPoll.questionPlaceholder' | t }}"
      />
      @for (opt of options(); track $index) {
        <div class="flex items-center gap-2 mb-1">
          <input
            hlmInput
            [(ngModel)]="options()[$index]"
            class="flex-1 p-2 rounded bg-surface-200 border-s border-surface-100 text-text-primary"
            [placeholder]="'quickPoll.optionPlaceholder' | t: { n: $index + 1 }"
          />
          @if (options().length > 2) {
            <button hlmBtn (click)="removeOption($index)" class="text-danger text-sm">
              {{ 'quickPoll.removeOption' | t }}
            </button>
          }
        </div>
      }
      <button hlmBtn (click)="addOption()" class="text-primary text-sm mb-3">
        {{ 'quickPoll.addOption' | t }}
      </button>
      <div class="flex justify-end gap-2">
        <button
          hlmBtn
          (click)="cancelled.emit()"
          class="px-4 py-2 rounded bg-surface-100 text-text-primary"
        >
          {{ 'common.cancel' | t }}
        </button>
        <button hlmBtn (click)="submit()" class="px-4 py-2 rounded bg-primary text-on-fill">
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
