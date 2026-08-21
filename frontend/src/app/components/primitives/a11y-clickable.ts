import { Directive } from '@angular/core';

/**
 * Makes any non-interactive element keyboard-accessible for desktop tab navigation.
 * Adds role="button", tabindex="0", and Enter/Space key handling.
 * Usage: <div (click)="handler()" appA11yClickable>...</div>
 */
@Directive({
  standalone: true,
  selector: '[appA11yClickable]',
  host: {
    '[attr.role]': '"button"',
    '[attr.tabindex]': '"0"',
    '(keydown.enter)': 'onEnter($any($event))',
    '(keydown.space)': 'onSpace($any($event))',
  },
})
export class A11yClickableDirective {
  onEnter(event: Event): void {
    const target = event.target as HTMLElement;
    target.click();
  }

  onSpace(event: Event): void {
    event.preventDefault();
    const target = event.target as HTMLElement;
    target.click();
  }
}
