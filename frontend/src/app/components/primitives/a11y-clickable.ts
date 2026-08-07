import { Directive, HostListener } from '@angular/core';

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
  },
})
export class A11yClickableDirective {
  @HostListener('keydown.enter', ['$event'])
  onEnter(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    target.click();
  }

  @HostListener('keydown.space', ['$event'])
  onSpace(event: KeyboardEvent): void {
    event.preventDefault();
    const target = event.target as HTMLElement;
    target.click();
  }
}