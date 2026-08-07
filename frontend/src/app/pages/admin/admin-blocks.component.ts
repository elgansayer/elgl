import { Component, computed, inject, resource, signal, ErrorHandler } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AdminService, AdminBlockEntry } from '../../services/admin.service';
<<<<<<< HEAD
=======
import { AdminOfflineBannerComponent } from '../../components/admin-offline-banner/admin-offline-banner.component';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
>>>>>>> origin/main
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { CrashReportService } from '../../services/crash-report.service';

@Component({
  selector: 'app-admin-blocks',
<<<<<<< HEAD
  imports: [CommonModule, TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
=======
  imports: [CommonModule, TranslatePipe, SanitiseHtmlPipe, AdminOfflineBannerComponent, AppEmptyStateComponent, AppSkeletonLoaderComponent],
>>>>>>> origin/main
  templateUrl: './admin-blocks.component.html',
})
export class AdminBlocksComponent {
  private readonly adminService = inject(AdminService);
  private readonly offlineStorage = inject(OfflineAdminStorageService);
  private readonly crashReportService = inject(CrashReportService);
  private readonly errorHandler = inject(ErrorHandler);
  readonly isOnline = this.offlineStorage.isOnline;

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly removingId = signal<string | null>(null);
  readonly actionError = signal('');
  private readonly refreshToken = signal(0);

  readonly request = computed(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
    refresh: this.refreshToken(),
  }));

  private readonly blocksResource = resource({
    params: () => this.request(),
    loader: ({ params }) =>
      this.adminService.listAllBlocks(params.page, params.pageSize),
  });

  readonly blocks = computed(() => this.blocksResource.value()?.blocks ?? []);
  readonly total = computed(() => this.blocksResource.value()?.total ?? 0);
  readonly isLoading = computed(() => this.blocksResource.isLoading());
  readonly resourceError = computed(() => this.blocksResource.error());

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  retry(): void {
    this.refreshToken.update((v) => v + 1);
  }

  async changePage(delta: number): Promise<void> {
    const next = this.page() + delta;
    if (next < 1 || next > this.totalPages()) return;
    this.page.set(next);
  }

  async removeBlock(block: AdminBlockEntry): Promise<void> {
    if (this.removingId()) return;
    this.removingId.set(block.id);
    this.actionError.set('');
    try {
      await this.adminService.removeBlock(block.id);
      this.blocksResource.update((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.filter((b) => b.id !== block.id),
          total: Math.max(0, prev.total - 1),
        };
      });
    } catch (err: unknown) {
      this.actionError.set('Failed to remove block');
      this.reportCrash(err, 'removeBlock');
    } finally {
      this.removingId.set(null);
    }
  }

  private reportCrash(err: unknown, action: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.crashReportService.reportCrash(error, {
      route: typeof window !== 'undefined' ? window.location.href : '/admin/blocks',
      component: 'AdminBlocksComponent',
      adminRole: 'admin',
      offline: !this.isOnline(),
      action,
    });
    this.errorHandler.handleError(error);
  }
}