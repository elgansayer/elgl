import { Component, input, inject, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-admin-user-actions',
  imports: [TranslatePipe],
  template: `
    <div class="flex gap-2">
      <button
        type="button"
        class="app-pill border border-surface-100 text-sm"
        [disabled]="banLoading()"
        (click)="handleBan()"
        [attr.aria-label]="'admin.banUserAria' | t: { name: displayName() }"
      >
        {{ (banLoading() ? 'admin.banning' : 'admin.banBtn') | t }}
      </button>
      <button
        type="button"
        class="app-pill border border-surface-100 text-sm"
        [disabled]="warnLoading()"
        (click)="handleWarn()"
        [attr.aria-label]="'admin.warnUserAria' | t: { name: displayName() }"
      >
        {{ (warnLoading() ? 'admin.warning' : 'admin.warnBtn') | t }}
      </button>
    </div>
  `,
})
export class AdminUserActionsComponent {
  userId = input.required<string>();
  displayName = input<string>('');
  actionCompleted = output<void>();

  private adminService = inject(AdminService);
  private i18n = inject(I18nService);

  readonly banLoading = this.adminService.banLoading;
  readonly warnLoading = this.adminService.warnLoading;

  async handleBan(): Promise<void> {
    if (!this.userId()) return;
    try {
      await this.adminService.banUser(this.userId());
      showToast(this.i18n.translate('admin.userBanned'), 'success');
      this.actionCompleted.emit();
    } catch {
      showErrorToast(this.i18n.translate('admin.banFailed'));
    }
  }

  async handleWarn(): Promise<void> {
    if (!this.userId()) return;
    try {
      await this.adminService.warnUser(this.userId());
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
      this.actionCompleted.emit();
    } catch {
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    }
  }
}
