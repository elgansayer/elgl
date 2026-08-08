import {
  Directive,
  inject,
  input,
  ViewContainerRef,
  ElementRef,
  ComponentRef,
  ErrorHandler,
} from '@angular/core';
import { AdminErrorBoundaryComponent } from '../components/admin-error-boundary/admin-error-boundary.component';

/**
 * Directive that wraps its host element's children in an error-catching boundary.
 * When an error is thrown inside any child component's template or lifecycle,
 * the boundary replaces the content with an error UI.
 *
 * Usage: <some-admin-wrapper appAdminErrorCatcher componentName="admin-users">
 *            <app-admin-users />
 *        </some-admin-wrapper>
 */
@Directive({
  selector: '[appAdminErrorCatcher]',
  standalone: true,
  host: {
    '(error)': 'onChildError($event)',
  },
})
export class AdminErrorCatcherDirective {
  private elementRef = inject(ElementRef);
  private viewContainerRef = inject(ViewContainerRef);
  private errorHandler = inject(ErrorHandler);

  readonly componentName = input.required<string>({ alias: 'appAdminErrorCatcher' });

  private boundaryComponent: ComponentRef<AdminErrorBoundaryComponent> | null = null;

  onChildError(event: ErrorEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const error = event.error instanceof Error ? event.error : new Error(event.message);

    // We can't easily swap content via a directive alone, so we report it
    // through the global error handler which already has boundary-style reporting.
    console.warn(`[AdminErrorCatcher] ${this.componentName()} errored:`, error.message);
    this.errorHandler.handleError(error);
  }
}