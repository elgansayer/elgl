import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pill',
  template: `
    <span [class]="pillClasses()">
      @if (label()) {
        {{ label() }}
      } @else {
        <ng-content />
      }
    </span>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppPillComponent {
  readonly label = input<string>('');
  readonly colour = input<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>(
    'neutral',
  );
  readonly size = input<'sm' | 'md'>('md');
  readonly customClass = input<string>('');

  readonly pillClasses = computed(() => {
    const base = 'inline-flex items-center justify-center font-extrabold rounded-full';

    const sizeClass =
      this.size() === 'sm'
        ? 'ps-2.5 pe-2.5 pt-0.5 pb-0.5 text-[10px]'
        : 'ps-3 pe-3 pt-1 pb-1 text-xs';

    let colourClass = '';
    switch (this.colour()) {
      case 'primary':
        colourClass = 'bg-primary/10 text-primary border border-primary/20';
        break;
      case 'success':
        colourClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        break;
      case 'warning':
        colourClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        break;
      case 'danger':
        colourClass = 'bg-rose-100 text-rose-800 border border-rose-200';
        break;
      case 'info':
        colourClass = 'bg-sky-100 text-sky-800 border border-sky-200';
        break;
      case 'neutral':
        colourClass = 'bg-surface-100 text-text-primary border border-surface-100';
        break;
    }

    const extra = this.customClass();
    return `${base} ${sizeClass} ${colourClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
