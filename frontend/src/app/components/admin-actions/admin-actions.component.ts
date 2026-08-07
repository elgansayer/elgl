import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-admin-actions',
  imports: [TranslatePipe],
  template: `
    <div class="admin-actions" role="region" [attr.aria-label]="'admin.quickModerationAria' | t">
      <h2>{{ 'admin.quickModeration' | t }}</h2>
      <ul role="list">
        @for (user of users(); track user.id) {
          <li>
            <span>{{ user.display_name ?? user.id }}</span>
            <button
              type="button"
              [attr.aria-label]="'admin.banUserAria' | t: { name: user.display_name ?? user.id }"
              (click)="ban(user.id)"
            >{{ 'admin.banBtn' | t }}</button>
            <button
              type="button"
              [attr.aria-label]="'admin.warnUserAria' | t: { name: user.display_name ?? user.id }"
              (click)="warn(user.id)"
            >{{ 'admin.warnBtn' | t }}</button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .admin-actions {
      margin: 16px;
    }
    button {
      margin-inline-start: 8px;
    }
  `,
})
export class AdminActionsComponent {
  private readonly adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);

  readonly users = signal<AdminUserSummary[]>([]);

  constructor() {
    this.adminService.listUsers('', 1, 10).then((result) => {
      this.users.set(result.users);
    });
  }

  async ban(userId: string) {
    try {
      await this.adminService.banUser(userId);
      showToast(this.i18n.translate('admin.userBanned'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.banFailed'));
    }
  }

  async warn(userId: string) {
    try {
      await this.adminService.warnUser(userId);
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    }
  }
}
