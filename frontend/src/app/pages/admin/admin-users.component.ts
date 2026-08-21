import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, resource, signal, ErrorHandler } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AdminOfflineBannerComponent } from '../../components/admin-offline-banner/admin-offline-banner.component';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';

import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { CrashReportService } from '../../services/crash-report.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    HlmInput,
    HlmButton,
    CommonModule,
    TranslatePipe,
    SanitiseHtmlPipe,
    AdminOfflineBannerComponent,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
  ],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent {
  private adminService = inject(AdminService);
  private offlineStorage = inject(OfflineAdminStorageService);
  private crashReportService = inject(CrashReportService);
  private errorHandler = inject(ErrorHandler);
  readonly isOnline = this.offlineStorage.isOnline;

  readonly searchTerm = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  private readonly refreshToken = signal(0);

  readonly renderError = signal<string>('');
  readonly hasRenderError = computed(() => this.renderError() !== '');

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

  readonly users = computed(() => {
    try {
      return this.usersResource.value()?.users ?? [];
    } catch (err: unknown) {
      this.reportCrash(err, 'users derivation');
      return [];
    }
  });

  readonly total = computed(() => this.usersResource.value()?.total ?? 0);
  readonly isLoading = computed(() => this.usersResource.isLoading());

  readonly pageTotal = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly selectedUserId = signal<string | null>(null);
  readonly showHistory = signal(false);
  readonly isVipUpdating = signal<string | null>(null);
  readonly vipUpdateError = signal<string>('');
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
    this.vipUpdateError.set('');
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
    } catch (err: unknown) {
      this.vipUpdateError.set((err as HttpErrorResponse)?.message ?? String(err));
      this.reportCrash(err, 'toggleVip');
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
    } catch (err: unknown) {
      this.reportCrash(err, 'banUser');
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
    } catch (err: unknown) {
      this.reportCrash(err, 'warnUser');
    } finally {
      this.isWarning.set(null);
    }
  }

  private reportCrash(err: unknown, action: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.crashReportService.reportCrash(error, {
      route: typeof window !== 'undefined' ? window.location.href : '/admin/users',
      component: 'AdminUsersComponent',
      adminRole: 'admin',
      offline: !this.isOnline(),
      action,
    });
    this.errorHandler.handleError(error);
  }
}
