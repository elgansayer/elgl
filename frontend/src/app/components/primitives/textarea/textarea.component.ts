import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-textarea',
  imports: [...HlmTextareaImports],
  template: `
    @if (label()) {
      <label [for]="textareaId()" class="mb-1 block text-xs font-bold text-text-primary">
        {{ label() }}
      </label>
    }
    <textarea
      hlmTextarea
      [id]="textareaId()"
      [rows]="rows()"
      [value]="value()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [class]="customClass()"
      (input)="onInput($event)"
      (blur)="onBlur($event)"
      (focus)="onFocus($event)"
    ></textarea>
  `,
  host: {
    '[class]': "'block w-full'",
  },
})
export class AppTextareaComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly rows = input<number>(3);
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly label = input<string>('');
  readonly textareaId = input<string>('app-textarea-' + crypto.randomUUID());
  readonly customClass = input<string>('');

  readonly valueChange = output<string>();
  readonly blurred = output<FocusEvent>();
  readonly focused = output<FocusEvent>();

  onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && !this.disabled()) {
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
