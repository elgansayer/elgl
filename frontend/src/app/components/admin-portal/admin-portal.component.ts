import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AdminService, AdminUserSummary, LoginHistoryEntry } from '../../services/admin.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-admin-portal',
  imports: [
    HlmInput,
    HlmButton,
    TranslatePipe,
    DatePipe,
    AppCardComponent,
    AppPillComponent,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
  ],
  templateUrl: './admin-portal.component.html',
  styleUrls: ['./admin-portal.component.scss'],
})
export class AdminPortalComponent {
  private readonly adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);

  readonly searchTerm = signal<string>('');
  readonly page = signal<number>(1);
  readonly pageSize = 20;

  private readonly usersResource = resource({
    params: () => ({
      search: this.searchTerm().trim(),
      page: this.page(),
      pageSize: this.pageSize,
    }),
    loader: ({ params }) =>
      this.adminService.listUsers(params.search, params.page, params.pageSize),
  });

  readonly users = computed(() => this.usersResource.value()?.users ?? []);
  readonly total = computed(() => this.usersResource.value()?.total ?? 0);
  readonly isLoading = this.usersResource.isLoading;
  readonly errorMessage = signal<string>('');

  readonly vipUpdatingId = signal<string | null>(null);
  readonly moderationActingId = signal<string | null>(null);
  readonly loginHistoryByUser = signal<Record<string, LoginHistoryEntry[]>>({});
  readonly loginHistoryLoadingId = signal<string | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  loadUsers(): void {
    this.usersResource.reload();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
  }

  runSearch(): void {
    this.page.set(1);
  }

  goToPage(delta: number): void {
    const nextPage = this.page() + delta;
    if (nextPage < 1 || nextPage > this.totalPages()) return;
    this.page.set(nextPage);
  }

  async toggleVip(user: AdminUserSummary): Promise<void> {
    this.vipUpdatingId.set(user.id);
    try {
      await this.adminService.setVipStatus(user.id, !user.is_vip);
      this.usersResource.reload();
    } catch {
      this.errorMessage.set(this.i18n.translate('admin.vipUpdateError'));
    } finally {
      this.vipUpdatingId.set(null);
    }
  }

  async onLoginHistoryToggle(user: AdminUserSummary, isOpen: boolean): Promise<void> {
    if (!isOpen || this.loginHistoryByUser()[user.id]) return;
    this.loginHistoryLoadingId.set(user.id);
    try {
      const history = await this.adminService.getLoginHistory(user.id);
      this.loginHistoryByUser.update((map) => ({
        ...map,
        [user.id]: history,
      }));
    } finally {
      this.loginHistoryLoadingId.set(null);
    }
  }

  displayNameFor(user: AdminUserSummary): string {
    return user.display_name || this.i18n.translate('common.unknownUser');
  }

  async handleWarn(user: AdminUserSummary): Promise<void> {
    const name = this.displayNameFor(user);
    if (!confirm(this.i18n.translate('admin.warnConfirm', { name }))) return;
    this.moderationActingId.set(user.id);
    try {
      await this.adminService.warnUser(user.id);
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    } finally {
      this.moderationActingId.set(null);
    }
  }

  async handleBan(user: AdminUserSummary): Promise<void> {
    const name = this.displayNameFor(user);
    if (!confirm(this.i18n.translate('admin.banConfirm', { name }))) return;
    this.moderationActingId.set(user.id);
    try {
      await this.adminService.banUser(user.id);
      showToast(this.i18n.translate('admin.userBanned'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.banFailed'));
    } finally {
      this.moderationActingId.set(null);
    }
  }
}
