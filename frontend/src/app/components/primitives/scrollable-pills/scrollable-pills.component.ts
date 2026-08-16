import { Component, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'app-scrollable-pills',
  imports: [...HlmButtonImports],
  template: `
    <div
      class="hide-scrollbar flex gap-2 overflow-x-auto bg-surface-500 px-4 py-2"
      role="radiogroup"
      [attr.aria-label]="ariaLabel() || null"
    >
      @for (pill of pills(); track pill.id) {
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="sm"
          class="whitespace-nowrap rounded-full"
          (click)="pillPicked.emit(pill.id)"
          [class.bg-primary]="selected() === pill.id"
          [class.text-on-fill]="selected() === pill.id"
          [class.bg-surface-300]="selected() !== pill.id"
          [class.text-text-secondary]="selected() !== pill.id"
          [class.border]="selected() !== pill.id"
          [class.border-surface-200]="selected() !== pill.id"
          role="radio"
          [attr.aria-checked]="selected() === pill.id"
          [attr.aria-label]="pill.label"
        >
          {{ pill.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `,
  ],
})
export class ScrollablePillsComponent {
  readonly pills = input.required<{ id: string; label: string }[]>();
  readonly selected = input.required<string>();
  readonly ariaLabel = input<string>('');
  readonly pillPicked = output<string>();
}
