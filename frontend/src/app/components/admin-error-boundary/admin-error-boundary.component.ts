import { Component, inject, input, signal, ErrorHandler } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { CrashReportService, AdminCrashContext } from '../../services/crash-report.service';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';

@Component({
  selector: 'app-admin-error-boundary',
  imports: [CommonModule, TranslatePipe, ...HlmButtonImports],
  template: `
    @if (hasError()) {
      <div
        class="mx-auto mt-8 flex max-w-lg flex-col items-center justify-center rounded-lg border border-danger/30 bg-surface-2 p-6"
        role="alert"
        aria-live="assertive"
      >
        <div class="mb-3 text-4xl" aria-hidden="true">⚠️</div>
        <h2 class="mb-2 text-lg font-semibold text-text-primary">
          {{ 'admin.errorBoundary.title' | t }}
        </h2>
        <p class="mb-1 text-center text-sm text-text-secondary">
          {{ 'admin.errorBoundary.description' | t }}
        </p>
        @if (errorMessage()) {
          <p class="mt-2 mb-3 max-w-full break-all text-center font-mono text-xs text-danger">
            {{ errorMessage() }}
          </p>
        }
        @if (pendingCount() > 0) {
          <p class="mt-2 mb-3 text-xs text-warning">
            {{ 'admin.errorBoundary.pendingReports' | t: { count: pendingCount() } }}
          </p>
        }
        <div class="mt-3 flex flex-wrap justify-center gap-3">
          <button hlmBtn type="button" size="touch" (click)="retry()" [attr.aria-label]="'admin.errorBoundary.retryAria' | t">
            {{ 'admin.errorBoundary.retry' | t }}
          </button>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="goHome()" [attr.aria-label]="'admin.errorBoundary.goHomeAria' | t">
            {{ 'admin.errorBoundary.goHome' | t }}
          </button>
          <button hlmBtn type="button" variant="outline" size="touch" (click)="toggleDetails()" [attr.aria-label]="'admin.errorBoundary.toggleDetailsAria' | t" [attr.aria-expanded]="showDetails()">
            {{
              (showDetails()
                ? 'admin.errorBoundary.hideDetails'
                : 'admin.errorBoundary.showDetails'
              ) | t
            }}
          </button>
        </div>
        @if (showDetails()) {
          <div class="mt-4 max-h-64 w-full overflow-y-auto rounded bg-surface-1 p-3">
            <p class="break-all whitespace-pre-wrap font-mono text-xs text-text-secondary">
              {{ errorStack() || ('admin.errorBoundary.noStack' | t) }}
            </p>
            @if (crashContext()) {
              <div class="mt-2 border-t border-surface-100 pt-2">
                <p class="text-xs text-text-secondary">{{ 'admin.errorBoundary.route' | t }}: {{ crashContext()?.route }}</p>
                <p class="text-xs text-text-secondary">{{ 'admin.errorBoundary.component' | t }}: {{ crashContext()?.component }}</p>
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
  styles: [`:host { display: block; }`],
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
    const context = this.buildCrashContext();
    this.hasError.set(true);
    this.errorMessage.set(error.message || 'Unknown rendering error');
    this.errorStack.set(error.stack || '');
    this.crashContext.set(context);
    this.crashReportService.reportCrash(error, context);
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
    this.showDetails.update((value) => !value);
  }

  private buildCrashContext(): AdminCrashContext {
    return {
      route: this.router.url || '',
      component: this.componentName(),
      adminRole: 'admin',
      offline: !this.offlineStorage.isOnline(),
    };
  }
}
