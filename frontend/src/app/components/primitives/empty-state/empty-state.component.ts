import { Component, input, output, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'app-empty-state',
  imports: [...HlmButtonImports],
  template: `
    <div [class]="containerClasses()" class="empty-state-fade-in">
      @if (illustration()) {
        <div class="mb-4" aria-hidden="true">
          <img [src]="illustration()" alt="" class="mx-auto h-auto w-48" loading="lazy" />
        </div>
      } @else {
        <div class="empty-state-icon mb-3 text-4xl" aria-hidden="true">{{ icon() }}</div>
      }
      @if (title()) {
        <h3 class="mb-1 text-base font-bold text-text-primary">{{ title() }}</h3>
      }
      @if (description()) {
        <p class="mb-4 max-w-sm text-xs text-text-secondary">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <button hlmBtn type="button" size="touch" (click)="onAction()">
          {{ actionLabel() }}
        </button>
      }
      <ng-content />
    </div>
  `,
  host: {
    '[class]': "'block w-full'",
    '[attr.role]': "'region'",
    '[attr.aria-label]': 'ariaLabelAttribute()',
  },
})
export class AppEmptyStateComponent {
  readonly illustration = input<string>('');
  readonly icon = input<string>('📭');
  readonly title = input<string>('');
  readonly description = input<string>('');
  readonly actionLabel = input<string>('');
  readonly customClass = input<string>('');

  readonly actionClicked = output<void>();

  readonly ariaLabelAttribute = computed(() => this.title() || 'Empty state');

  readonly containerClasses = computed(() => {
    const base =
      'flex flex-col items-center justify-center rounded-card border border-dashed border-surface-100 bg-surface-300 p-6 text-center';
    const extra = this.customClass();
    return `${base}${extra ? ' ' + extra : ''}`.trim();
  });

  onAction(): void {
    this.actionClicked.emit();
  }
}
