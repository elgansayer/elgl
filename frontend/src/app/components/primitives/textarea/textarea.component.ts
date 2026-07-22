import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-textarea',
  template: `
    @if (label()) {
      <label [for]="textareaId()" class="block font-bold text-xs text-slate-700 mb-1">
        {{ label() }}
      </label>
    }
    <textarea
      [id]="textareaId()"
      [rows]="rows()"
      [value]="value()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [class]="textareaClasses()"
      (input)="onInput($event)"
      (blur)="onBlur($event)"
      (focus)="onFocus($event)"
    ></textarea>
  `,
  host: {
    '[class]': "'block w-full'"
  }
})
export class AppTextareaComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly rows = input<number>(3);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly label = input<string>('');
  readonly textareaId = input<string>('app-textarea-' + Math.random().toString(36).substring(2, 9));
  readonly customClass = input<string>('');

  readonly valueChange = output<string>();
  readonly blurred = output<FocusEvent>();
  readonly focused = output<FocusEvent>();

  readonly textareaClasses = computed(() => {
    const base = 'block w-full rounded-2xl border ps-4 pe-4 pt-3 pb-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';
    const state = this.disabled()
      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
      : 'bg-white border-slate-200 text-slate-800';
    const extra = this.customClass();
    return `${base} ${state}${extra ? ' ' + extra : ''}`.trim();
  });

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    if (target && !this.disabled()) {
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
