import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-button-secondary',
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="buttonClasses()"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: {
    '[class]': "'inline-block'"
  }
})
export class AppButtonSecondaryComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly customClass = input<string>('');

  readonly clicked = output<MouseEvent>();

  readonly buttonClasses = computed(() => {
    const base = 'inline-flex items-center justify-center font-bold rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2';
    
    let sizeClass = '';
    switch (this.size()) {
      case 'sm':
        sizeClass = 'ps-3 pe-3 pt-1.5 pb-1.5 text-xs';
        break;
      case 'md':
        sizeClass = 'ps-4 pe-4 pt-2.5 pb-2.5 text-sm';
        break;
      case 'lg':
        sizeClass = 'ps-6 pe-6 pt-3.5 pb-3.5 text-base';
        break;
    }

    const stateClass = this.disabled()
      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
      : 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 shadow-sm cursor-pointer';

    const extra = this.customClass();
    return `${base} ${sizeClass} ${stateClass}${extra ? ' ' + extra : ''}`.trim();
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}
