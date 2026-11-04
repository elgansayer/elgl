import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

interface PollOptionDraft {
  id: number;
  value: string;
}

const MAX_OPTIONS = 6;
const MAX_QUESTION_LENGTH = 300;
const MAX_OPTION_LENGTH = 100;

@Component({
  selector: 'app-quick-poll-form',
  imports: [TranslatePipe, ...HlmInputImports, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog state="open" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-sheet border border-surface-100 bg-surface-200 p-0 shadow-lift motion-reduce:animate-none"
      >
        <hlm-dialog-header class="border-b border-surface-100 p-5 text-start">
          <h2 hlmDialogTitle class="text-lg font-bold text-text-primary">
            {{ 'quickPoll.title' | t }}
          </h2>
          <p hlmDialogDescription class="text-sm text-text-secondary">
            {{ 'quickPoll.description' | t }}
          </p>
        </hlm-dialog-header>

        <div class="flex flex-col gap-4 p-5">
          <label [for]="questionId" class="text-sm font-medium text-text-primary">
            {{ 'quickPoll.questionLabel' | t }}
          </label>
          <input
            hlmInput
            [id]="questionId"
            type="text"
            [value]="question()"
            (input)="updateQuestion($event)"
            class="w-full"
            [attr.maxlength]="maxQuestionLength"
          />

          <fieldset class="flex flex-col gap-3">
            <legend class="text-sm font-medium text-text-primary">
              {{ 'quickPoll.optionsLabel' | t }}
            </legend>
            @for (option of options(); track option.id; let index = $index) {
              <div class="flex items-center gap-2">
                <label class="sr-only" [for]="optionInputId(option.id)">
                  {{ 'quickPoll.optionLabel' | t: { n: index + 1 } }}
                </label>
                <input
                  hlmInput
                  [id]="optionInputId(option.id)"
                  type="text"
                  [value]="option.value"
                  (input)="updateOption(option.id, $event)"
                  class="min-w-0 flex-1"
                  [attr.maxlength]="maxOptionLength"
                />
                @if (options().length > 2) {
                  <button
                    hlmBtn
                    type="button"
                    variant="ghost"
                    size="touch"
                    (click)="removeOption(option.id)"
                    [attr.aria-label]="'quickPoll.removeOptionLabel' | t: { n: index + 1 }"
                  >
                    {{ 'quickPoll.removeOption' | t }}
                  </button>
                }
              </div>
            }
          </fieldset>

          <button
            hlmBtn
            type="button"
            variant="outline"
            size="touch"
            (click)="addOption()"
            [disabled]="!canAddOption()"
          >
            {{ 'quickPoll.addOption' | t }}
          </button>

          @if (showValidationError()) {
            <p class="text-sm text-danger-ink" role="alert">
              {{ 'quickPoll.validationError' | t }}
            </p>
          }
        </div>

        <hlm-dialog-footer class="flex-col gap-2 border-t border-surface-100 p-5 sm:flex-row">
          <button
            hlmBtn
            hlmDialogClose
            type="button"
            variant="secondary"
            size="touch"
            class="w-full sm:w-auto"
          >
            {{ 'common.cancel' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="w-full sm:w-auto"
            (click)="submit()"
            [disabled]="submitting()"
            [attr.aria-busy]="submitting()"
          >
            {{ (submitting() ? 'common.pleaseWait' : 'quickPoll.submitPoll') | t }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class QuickPollFormComponent {
  readonly question = signal('');
  readonly options = signal<PollOptionDraft[]>([
    { id: 1, value: '' },
    { id: 2, value: '' },
  ]);
  readonly showValidationError = signal(false);
  readonly submitting = input(false);
  readonly submitPoll = output<{ question: string; options: string[] }>();
  readonly cancelled = output<void>();
  readonly questionId = `quick-poll-question-${crypto.randomUUID()}`;
  readonly maxQuestionLength = MAX_QUESTION_LENGTH;
  readonly maxOptionLength = MAX_OPTION_LENGTH;
  readonly canAddOption = computed(() => this.options().length < MAX_OPTIONS);
  private nextOptionId = 3;

  addOption(): void {
    if (!this.canAddOption()) return;
    const id = this.nextOptionId;
    this.nextOptionId += 1;
    this.options.update((list) => [...list, { id, value: '' }]);
  }

  removeOption(id: number): void {
    if (this.options().length <= 2) return;
    this.options.update((list) => list.filter((option) => option.id !== id));
  }

  updateQuestion(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.question.set(event.target.value);
      this.showValidationError.set(false);
    }
  }

  updateOption(id: number, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    const value = event.target.value;
    this.options.update((list) =>
      list.map((option) => (option.id === id ? { ...option, value } : option)),
    );
    this.showValidationError.set(false);
  }

  optionInputId(id: number): string {
    return `quick-poll-option-${id}`;
  }

  submit(): void {
    if (this.submitting()) return;
    const q = this.question().trim();
    const opts = this.options()
      .map((option) => option.value.trim())
      .filter((option) => option.length > 0);
    const uniqueOptions = new Set(opts.map((option) => option.toLocaleLowerCase()));
    if (
      !q ||
      q.length > MAX_QUESTION_LENGTH ||
      opts.length < 2 ||
      opts.some((option) => option.length > MAX_OPTION_LENGTH) ||
      uniqueOptions.size !== opts.length
    ) {
      this.showValidationError.set(true);
      return;
    }
    this.submitPoll.emit({ question: q, options: opts });
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') this.cancelled.emit();
  }
}
