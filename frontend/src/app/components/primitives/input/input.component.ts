import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslatePipe } from '../../../services/translate.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-input',
  imports: [TranslatePipe, ...HlmInputImports],
  template: `
    @if (label()) {
      <label [for]="inputId()" class="mb-1 block text-xs font-bold text-text-primary">
        {{ label() | t }}
      </label>
    }
    <input
      hlmInput
      [id]="inputId()"
      [type]="type()"
      [value]="value() ?? ''"
      [placeholder]="placeholder() | t"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [class]="customClass()"
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
  readonly value = input<string | null | undefined>('');
  readonly placeholder = input<string>('');
  readonly type = input<'text' | 'email' | 'password' | 'number' | 'url'>('text');
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly label = input<string>('');
  readonly inputId = input<string>('app-input-' + crypto.randomUUID());
  readonly customClass = input<string>('');

  readonly valueChange = output<string>();
  readonly blurred = output<FocusEvent>();
  readonly focused = output<FocusEvent>();

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
