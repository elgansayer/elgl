import { Directive, signal } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';
import type { ClassValue } from 'clsx';

@Directive({
  selector: 'input[hlmInput]',
  exportAs: 'hlmInput',
  host: { 'data-slot': 'input' },
})
export class HlmInput {
  private readonly _additionalClasses = signal<ClassValue>('');

  constructor() {
    classes(() => [
      'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      this._additionalClasses(),
    ]);
  }

  setClass(value: string): void {
    this._additionalClasses.set(value);
  }
}
