import { Component, inject, input, signal, ErrorHandler } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { CrashReportService, AdminCrashContext } from '../../services/crash-report.service';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';

@Component({
  selector: 'app-admin-error-boundary',
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (hasError()) {
      <div
        class="flex flex-col items-center justify-center p-6 rounded-lg bg-surface-2 border border-rose-600/30 max-w-lg mx-auto mt-8"
        role="alert"
        aria-live="assertive"
      >
        <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
        <h2 class="text-lg font-semibold text-text-primary mb-2">
          {{ 'admin.errorBoundary.title' | t }}
        </h2>
        <p class="text-sm text-text-secondary mb-1 text-center">
          {{ 'admin.errorBoundary.description' | t }}
        </p>
        @if (errorMessage()) {
          <p class="text-xs text-rose-400 mt-2 mb-3 font-mono break-all text-center max-w-full">
            {{ errorMessage() }}
          </p>
        }
        @if (pendingCount() > 0) {
          <p class="text-xs text-amber-400 mt-2 mb-3">
            {{ 'admin.errorBoundary.pendingReports' | t: { count: pendingCount() } }}
          </p>
        }
        <div class="flex gap-3 mt-3">
          <button
            type="button"
            class="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
            (click)="retry()"
            [attr.aria-label]="'admin.errorBoundary.retryAria' | t"
          >
            {{ 'admin.errorBoundary.retry' | t }}
          </button>
          <button
            type="button"
            class="px-4 py-2 border border-surface-100 rounded-lg text-sm hover:bg-surface-100 transition-colors"
            (click)="goHome()"
            [attr.aria-label]="'admin.errorBoundary.goHomeAria' | t"
          >
            {{ 'admin.errorBoundary.goHome' | t }}
          </button>
          <button
            type="button"
            class="px-4 py-2 border border-surface-100 rounded-lg text-sm hover:bg-surface-100 transition-colors"
            (click)="toggleDetails()"
            [attr.aria-label]="'admin.errorBoundary.toggleDetailsAria' | t"
          >
            {{
              (showDetails()
                ? 'admin.errorBoundary.hideDetails'
                : 'admin.errorBoundary.showDetails'
              ) | t
            }}
          </button>
        </div>
        @if (showDetails()) {
          <div class="mt-4 p-3 bg-surface-1 rounded w-full max-h-64 overflow-y-auto">
            <p class="text-xs text-text-secondary font-mono whitespace-pre-wrap break-all">
              {{ errorStack() || ('admin.errorBoundary.noStack' | t) }}
            </p>
            @if (crashContext()) {
              <div class="mt-2 pt-2 border-t border-surface-100">
                <p class="text-xs text-text-secondary">
                  {{ 'admin.errorBoundary.route' | t }}: {{ crashContext()?.route }}
                </p>
                <p class="text-xs text-text-secondary">
                  {{ 'admin.errorBoundary.component' | t }}: {{ crashContext()?.component }}
                </p>
                <p class="text-xs text-text-secondary">
                  {{ 'admin.errorBoundary.offline' | t }}:
                  {{ crashContext()?.offline ? ('common.yes' | t) : ('common.no' | t) }}
                </p>
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AdminErrorBoundaryComponent {
  private crashReportService = inject(CrashReportService);
  private offlineStorage = inject(OfflineAdminStorageService);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandler);

  readonly componentName = input('AdminErrorBoundary');

  protected readonly hasError = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly errorStack = signal('');
  protected readonly crashContext = signal<AdminCrashContext | null>(null);
  protected readonly showDetails = signal(false);
  protected readonly pendingCount = this.crashReportService.pendingCrashCount;

  handleError(error: Error): void {
    const context: AdminCrashContext = this.buildCrashContext();

    this.hasError.set(true);
    this.errorMessage.set(error.message || 'Unknown rendering error');
    this.errorStack.set(error.stack || '');
    this.crashContext.set(context);

    // Trigger crash reporting
    this.crashReportService.reportCrash(error, context);

    // Also invoke the global error handler for centralized analytics
    this.errorHandler.handleError(error);
  }

  retry(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
    this.errorStack.set('');
    this.crashContext.set(null);
    this.showDetails.set(false);
  }

  goHome(): void {
    this.router.navigate(['/admin']);
  }

  toggleDetails(): void {
    this.showDetails.update((v) => !v);
  }

  private buildCrashContext(): AdminCrashContext {
    const routePath = this.router.url || '';
    return {
      route: routePath,
      component: this.componentName(),
      adminRole: 'admin',
      offline: !this.offlineStorage.isOnline(),
    };
  }
}
