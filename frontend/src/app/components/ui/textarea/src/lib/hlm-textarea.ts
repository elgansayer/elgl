import { Directive, signal } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';
import type { ClassValue } from 'clsx';

@Directive({
  selector: 'textarea[hlmTextarea]',
  exportAs: 'hlmTextarea',
  host: { 'data-slot': 'textarea' },
})
export class HlmTextarea {
  private readonly _additionalClasses = signal<ClassValue>('');

  constructor() {
    classes(() => [
      'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
      this._additionalClasses(),
    ]);
  }

  setClass(value: string): void {
    this._additionalClasses.set(value);
  }
}
