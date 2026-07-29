import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-input',
  template: `
    @if (label()) {
      <label [for]="inputId()" class="block font-bold text-xs text-text-primary mb-1">
        {{ label() }}
      </label>
    }
    <input
      [id]="inputId()"
      [type]="type()"
      [value]="value()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [class]="inputClasses()"
      (input)="onInput($event)"
      (blur)="onBlur($event)"
      (focus)="onFocus($event)"
    />
  `,
  host: {
    '[class]': "'block w-full'",
  },
})
export class AppInputComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly type = input<'text' | 'email' | 'password' | 'number' | 'url'>('text');
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly label = input<string>('');
  readonly inputId = input<string>('app-input-' + Math.random().toString(36).substring(2, 9));
  readonly customClass = input<string>('');

  readonly valueChange = output<string>();
  readonly blurred = output<FocusEvent>();
  readonly focused = output<FocusEvent>();

  readonly inputClasses = computed(() => {
    const base =
      'block w-full rounded-2xl border ps-4 pe-4 pt-2.5 pb-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';
    const state = this.disabled()
      ? 'bg-surface-100 text-text-muted border-surface-100 cursor-not-allowed'
      : 'bg-surface-200 border-surface-100 text-text-primary';
    const extra = this.customClass();
    return `${base} ${state}${extra ? ' ' + extra : ''}`.trim();
  });

  onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && !this.disabled()) {
      this.valueChange.emit(target.value);
    }
  }

  onBlur(event: FocusEvent): void {
    this.blurred.emit(event);
  }

  onFocus(event: FocusEvent): void {
    this.focused.emit(event);
  }
}
