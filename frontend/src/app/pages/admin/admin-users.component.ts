import { Component, computed, inject, resource, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { AdminOfflineBannerComponent } from '../../components/admin-offline-banner/admin-offline-banner.component';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';

@Component({
  selector: 'app-admin-users',
imports: [CommonModule, TranslatePipe, SanitiseHtmlPipe, AdminOfflineBannerComponent],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent {
  private adminService = inject(AdminService);
  private offlineStorage = inject(OfflineAdminStorageService);
  readonly isOnline = this.offlineStorage.isOnline;

  readonly searchTerm = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  private readonly refreshToken = signal(0);

  private readonly request = computed(() => ({
    search: this.searchTerm(),
    page: this.page(),
    pageSize: this.pageSize(),
    refresh: this.refreshToken(),
  }));

  private readonly usersResource = resource({
    params: () => this.request(),
    loader: ({ params }) =>
      this.adminService.listUsers(params.search, params.page, params.pageSize),
  });

  readonly users = computed(() => this.usersResource.value()?.users ?? []);
  readonly total = computed(() => this.usersResource.value()?.total ?? 0);
  readonly isLoading = computed(() => this.usersResource.isLoading());

  readonly pageTotal = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly selectedUserId = signal<string | null>(null);
  readonly showHistory = signal(false);
  readonly isVipUpdating = signal<string | null>(null);
  readonly isBanning = signal<string | null>(null);
  readonly isWarning = signal<string | null>(null);

  private readonly historyResource = resource({
    params: () => this.selectedUserId(),
    loader: ({ params }) => {
      if (!params) {
        return Promise.resolve([]);
      }
      return this.adminService.getLoginHistory(params);
    },
  });

  readonly loginHistory = computed(() => this.historyResource.value() ?? []);

  onSearchInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.searchTerm.set(target.value);
    }
    this.page.set(1);
    this.refreshToken.update((v) => v + 1);
  }

  changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.pageTotal()) {
      return;
    }
    this.page.set(next);
    this.refreshToken.update((v) => v + 1);
  }

  async toggleVip(user: AdminUserSummary): Promise<void> {
    if (this.isVipUpdating()) {
      return;
    }
    this.isVipUpdating.set(user.id);
    try {
      const updated = await this.adminService.setVipStatus(
        user.id,
        !user.is_vip,
        !user.is_vip ? 'consumer_8_ukp_10_usd' : 'free',
      );
      this.usersResource.update((prev) => {
        if (!prev) {
          return prev;
        }
        const list = prev.users.map((u) => (u.id === updated.id ? updated : u));
        return { ...prev, users: list };
      });
    } finally {
      this.isVipUpdating.set(null);
      this.refreshToken.update((v) => v + 1);
    }
  }

  openHistory(user: AdminUserSummary): void {
    this.selectedUserId.set(user.id);
    this.showHistory.set(true);
  }

  closeHistory(): void {
    this.showHistory.set(false);
    this.selectedUserId.set(null);
  }

  async banUser(user: AdminUserSummary): Promise<void> {
    if (this.isBanning()) {
      return;
    }
    this.isBanning.set(user.id);
    try {
      await this.adminService.banUser(user.id);
    } finally {
      this.isBanning.set(null);
    }
  }

  async warnUser(user: AdminUserSummary): Promise<void> {
    if (this.isWarning()) {
      return;
    }
    this.isWarning.set(user.id);
    try {
      await this.adminService.warnUser(user.id);
    } finally {
      this.isWarning.set(null);
    }
  }
}
