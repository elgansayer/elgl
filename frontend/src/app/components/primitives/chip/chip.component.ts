import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chip',
  template: `
    <span
      [class]="chipClasses()"
      role="button"
      tabindex="0"
      (click)="onClick($event)"
      (keydown.enter)="onClickKey($event)"
    >
      @if (label()) {
        {{ label() }}
      } @else {
        <ng-content />
      }
      @if (removable()) {
        <button
          type="button"
          (click)="onRemove($event)"
          class="ms-1.5 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-1"
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

  readonly chipClasses = computed(() => {
    const base =
      'inline-flex items-center rounded-xl font-bold text-xs ps-3 pe-3 pt-1.5 pb-1.5 transition-all cursor-pointer';

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
        variantClass = 'bg-primary text-white shadow-sm';
        break;
    }

    const extra = this.customClass();
    return `${base} ${variantClass}${extra ? ' ' + extra : ''}`.trim();
  });

  onClick(event: MouseEvent): void {
    this.clicked.emit(event);
  }

  onClickKey(_event: Event): void {
    const syntheticEvent = new MouseEvent('click');
    this.clicked.emit(syntheticEvent);
  }

  onRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.removed.emit();
  }
}
