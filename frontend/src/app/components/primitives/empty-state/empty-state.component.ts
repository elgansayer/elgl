import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div [class]="containerClasses()">
      <div class="text-4xl mb-3" aria-hidden="true">{{ icon() }}</div>
      @if (title()) {
        <h3 class="font-bold text-base text-slate-800 mb-1">{{ title() }}</h3>
      }
      @if (description()) {
        <p class="text-xs text-slate-500 max-w-sm mb-4">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <button
          type="button"
          (click)="onAction()"
          class="inline-flex items-center justify-center font-bold text-xs bg-primary text-white ps-4 pe-4 pt-2 pb-2 rounded-xl hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {{ actionLabel() }}
        </button>
      }
      <ng-content />
    </div>
  `,
  host: {
    '[class]': "'block w-full'",
    '[attr.role]': "'region'",
    '[attr.aria-label]': 'ariaLabelAttribute()'
  }
})
export class AppEmptyStateComponent {
  readonly icon = input<string>('📭');
  readonly title = input<string>('');
  readonly description = input<string>('');
  readonly actionLabel = input<string>('');
  readonly customClass = input<string>('');

  readonly actionClicked = output<void>();

  readonly ariaLabelAttribute = computed(() => {
    return this.title() || 'Empty state';
  });

  readonly containerClasses = computed(() => {
    const base = 'flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200';
    const extra = this.customClass();
    return `${base}${extra ? ' ' + extra : ''}`.trim();
  });

  onAction(): void {
    this.actionClicked.emit();
  }
}
