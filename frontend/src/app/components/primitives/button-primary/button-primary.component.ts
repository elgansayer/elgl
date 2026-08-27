import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { HlmButton, HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-button-primary',
  imports: [...HlmButtonImports],
  template: `
    <button
      hlmBtn
      variant="default"
      [size]="helmSize()"
      [type]="type()"
      [disabled]="disabled()"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppButtonPrimaryComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly customClass = input<string>('');
  readonly clicked = output<MouseEvent>();

  readonly helmSize = computed(() => {
    const size = this.size();
    return size === 'md' ? 'touch' : size;
  });

  private readonly helmButton = viewChild(HlmButton);

  constructor() {
    effect(() => {
      this.helmButton()?.setClass(this.customClass());
    });
  }

  onClick(event: MouseEvent): void {
    if (!this.disabled()) this.clicked.emit(event);
  }
}
