import { Component, computed, inject, resource, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent {
  private adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);

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
  readonly isModerating = signal<string | null>(null);

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

  async banUser(user: AdminUserSummary): Promise<void> {
    if (this.isModerating()) return;
    this.isModerating.set(user.id);
    try {
      await this.adminService.banUser(user.id);
      this.updateUserInList(user.id, { is_banned: true });
      showToast(this.i18n.translate('admin.userBanned'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.banFailed'));
    } finally {
      this.isModerating.set(null);
      this.refreshToken.update((v) => v + 1);
    }
  }

  async unbanUser(user: AdminUserSummary): Promise<void> {
    if (this.isModerating()) return;
    this.isModerating.set(user.id);
    try {
      await this.adminService.unbanUser(user.id);
      this.updateUserInList(user.id, { is_banned: false });
      showToast(this.i18n.translate('admin.userUnbanned'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.unbanFailed'));
    } finally {
      this.isModerating.set(null);
      this.refreshToken.update((v) => v + 1);
    }
  }

  async warnUser(user: AdminUserSummary): Promise<void> {
    if (this.isModerating()) return;
    this.isModerating.set(user.id);
    try {
      await this.adminService.warnUser(user.id);
      const newCount = (user.warning_count ?? 0) + 1;
      this.updateUserInList(user.id, { warning_count: newCount });
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    } finally {
      this.isModerating.set(null);
      this.refreshToken.update((v) => v + 1);
    }
  }

  private updateUserInList(userId: string, patch: Partial<AdminUserSummary>): void {
    this.usersResource.update((prev) => {
      if (!prev) return prev;
      const list = prev.users.map((u) =>
        u.id === userId ? { ...u, ...patch } : u,
      );
      return { ...prev, users: list };
    });
  }

  openHistory(user: AdminUserSummary): void {
    this.selectedUserId.set(user.id);
    this.showHistory.set(true);
  }

  closeHistory(): void {
    this.showHistory.set(false);
    this.selectedUserId.set(null);
  }
}
