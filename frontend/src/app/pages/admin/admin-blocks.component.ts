import { Component, computed, inject, resource, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AdminService, AdminBlockEntry } from '../../services/admin.service';
import { AdminOfflineBannerComponent } from '../../components/admin-offline-banner/admin-offline-banner.component';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';

@Component({
  selector: 'app-admin-blocks',
imports: [CommonModule, TranslatePipe, SanitiseHtmlPipe, AdminOfflineBannerComponent],
  templateUrl: './admin-blocks.component.html',
})
export class AdminBlocksComponent {
  private readonly adminService = inject(AdminService);
  private readonly offlineStorage = inject(OfflineAdminStorageService);
  readonly isOnline = this.offlineStorage.isOnline;

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly removingId = signal<string | null>(null);
  readonly actionError = signal('');

  readonly request = computed(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
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
    } catch {
      this.actionError.set('Failed to remove block');
    } finally {
      this.removingId.set(null);
    }
  }
}