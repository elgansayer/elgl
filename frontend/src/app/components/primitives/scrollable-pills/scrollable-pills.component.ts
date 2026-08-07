import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-scrollable-pills',
  template: `
    <div
      class="flex overflow-x-auto hide-scrollbar gap-2 px-4 py-2 bg-surface-500"
      role="radiogroup"
      [attr.aria-label]="ariaLabel() || null"
    >
      @for (pill of pills(); track pill.id) {
        <button
          (click)="pillPicked.emit(pill.id)"
          class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200"
          [class.bg-purple-600]="selected() === pill.id"
          [class.text-white]="selected() === pill.id"
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
  // Renamed to avoid collision with native DOM events (e.g. 'select')
  readonly pillPicked = output<string>();
}
