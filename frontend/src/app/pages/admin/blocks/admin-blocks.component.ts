import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, resource, signal, ErrorHandler } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { AdminService, AdminBlockedUser } from '../../../services/admin.service';
import { AppCardComponent } from '../../../components/primitives/card/card.component';
import { AppEmptyStateComponent } from '../../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../../components/primitives/skeleton-loader/skeleton-loader.component';
import { CrashReportService } from '../../../services/crash-report.service';

@Component({
  selector: 'app-admin-blocks',
  imports: [
    HlmButton,
    TranslatePipe,
    DatePipe,
    AppCardComponent,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
  ],
  templateUrl: './admin-blocks.component.html',
  styles: [],
})
export class AdminBlocksComponent {
  private readonly adminService = inject(AdminService);
  private readonly crashReportService = inject(CrashReportService);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly refreshToken = signal(0);

  private readonly blocksResource = resource({
    params: () => this.refreshToken(),
    loader: () => this.adminService.listBlockedUsers(),
  });

  readonly blockedUsers = computed(() => this.blocksResource.value() ?? []);
  readonly isLoading = computed(() => this.blocksResource.isLoading());
  readonly loadError = computed(() => !!this.blocksResource.error());

  private readonly unblockingIds = signal<Set<string>>(new Set());

  isUnblocking(userId: string): boolean {
    return this.unblockingIds().has(userId);
  }

  async onUnblock(user: AdminBlockedUser): Promise<void> {
    this.unblockingIds.update((set) => new Set(set).add(user.id));
    try {
      await this.adminService.adminUnblockUser(user.id);
      this.refreshToken.update((v) => v + 1);
    } catch (err: unknown) {
      this.reportCrash(err, 'onUnblock');
      // Reload to get consistent state
      this.refreshToken.update((v) => v + 1);
    } finally {
      this.unblockingIds.update((set) => {
        const next = new Set(set);
        next.delete(user.id);
        return next;
      });
    }
  }

  onRetry(): void {
    this.refreshToken.update((v) => v + 1);
  }

  private reportCrash(err: unknown, action: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.crashReportService.reportCrash(error, {
      route: typeof window !== 'undefined' ? window.location.href : '/admin/blocks',
      component: 'AdminBlocksComponent',
      adminRole: 'admin',
      offline: false,
      action,
    });
    this.errorHandler.handleError(error);
  }
}
