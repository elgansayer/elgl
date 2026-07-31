import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-scrollable-pills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex overflow-x-auto hide-scrollbar gap-2 px-4 py-2 bg-surface-500">
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
  pills = input.required<{ id: string; label: string }[]>();
  selected = input.required<string>();
  // Renamed to avoid collision with native DOM events (e.g. 'select')
  pillPicked = output<string>();
}
