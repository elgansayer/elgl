import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chip',
  imports: [...HlmButtonImports],
  template: `
    <span class="inline-flex items-center rounded-pill" [class]="containerClasses()">
      <button
        hlmBtn
        type="button"
        variant="ghost"
        size="sm"
        class="rounded-pill"
        [attr.aria-pressed]="selected()"
        (click)="onClick($event)"
      >
        @if (label()) {
          {{ label() }}
        } @else {
          <ng-content />
        }
      </button>
      @if (removable()) {
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="icon-xs"
          class="me-1 rounded-full"
          (click)="onRemove($event)"
          aria-label="Remove chip"
        >
          ✕
        </button>
      }
    </span>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppChipComponent {
  readonly label = input<string>('');
  readonly removable = input<boolean>(false);
  readonly selected = input<boolean>(false);
  readonly variant = input<'default' | 'outlined' | 'primary'>('default');
  readonly customClass = input<string>('');

  readonly removed = output<void>();
  readonly clicked = output<MouseEvent>();

  readonly containerClasses = computed(() => {
    let variantClass = '';
    switch (this.variant()) {
      case 'default':
        variantClass = this.selected()
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'bg-surface-100 text-text-primary border border-surface-100';
        break;
      case 'outlined':
        variantClass = this.selected()
          ? 'border-2 border-primary text-primary bg-surface-200'
          : 'border border-surface-100 text-text-primary bg-surface-200';
        break;
      case 'primary':
        variantClass = 'bg-primary text-on-fill shadow-card';
        break;
    }
    return `${variantClass}${this.customClass() ? ` ${this.customClass()}` : ''}`;
  });

  onClick(event: MouseEvent): void {
    this.clicked.emit(event);
  }

  onRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.removed.emit();
  }
}
