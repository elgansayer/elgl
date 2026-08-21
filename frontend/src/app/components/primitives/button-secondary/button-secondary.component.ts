import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-button-secondary',
  imports: [...HlmButtonImports],
  template: `
    <button
      hlmBtn
      variant="secondary"
      [size]="helmSize()"
      [type]="type()"
      [disabled]="disabled()"
      [class]="customClass()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-pressed]="ariaPressed() === null ? null : ariaPressed()"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppButtonSecondaryComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly customClass = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly ariaPressed = input<boolean | null>(null);
  readonly clicked = output<MouseEvent>();

  readonly helmSize = computed(() => {
    const size = this.size();
    return size === 'md' ? 'touch' : size;
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) this.clicked.emit(event);
  }
}
