import { Directive, ElementRef, OnDestroy, Renderer2, effect, inject, input } from '@angular/core';

const VIEW_TRANSITION_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

/**
 * Assigns a bounded, application-owned View Transition name.
 *
 * Names must be stable and unique within a rendered document. Do not derive a
 * name from user text, email, media URL or another private value.
 */
@Directive({
  selector: '[appViewTransitionName]',
  standalone: true,
})
export class ViewTransitionNameDirective implements OnDestroy {
  readonly appViewTransitionName = input.required<string>();
  readonly appViewTransitionDisabled = input(false);

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  constructor() {
    effect(() => {
      const name = this.appViewTransitionName().trim();
      if (this.appViewTransitionDisabled()) {
        this.removeName();
        return;
      }
      if (!VIEW_TRANSITION_NAME_PATTERN.test(name)) {
        throw new Error(
          'View transition names must begin with a letter and contain only letters, numbers, hyphens or underscores',
        );
      }
      this.renderer.setStyle(this.element.nativeElement, 'view-transition-name', name);
    });
  }

  ngOnDestroy(): void {
    this.removeName();
  }

  private removeName(): void {
    this.renderer.removeStyle(this.element.nativeElement, 'view-transition-name');
  }
}
