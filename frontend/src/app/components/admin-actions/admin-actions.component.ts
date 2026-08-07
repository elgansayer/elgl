import { Component, inject, signal, OnInit } from '@angular/core';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  imports: [TranslatePipe],
  selector: 'app-admin-actions',
  template: `
    <div class="admin-actions">
      <h2>{{ 'components.admin-actions.oneclickModeration' | t }}</h2>
      <ul>
        @for (user of users(); track user.id) {
          <li>
            <span>{{ user.display_name ?? user.id }}</span>
            <button (click)="ban(user.id)">{{ 'components.admin-actions.ban' | t }}</button>
            <button (click)="warn(user.id)">{{ 'components.admin-actions.warn' | t }}</button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      .admin-actions {
        margin: 16px;
      }
      button {
        margin-left: 8px;
      }
    `,
  ],
})
export class AdminActionsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);

  readonly users = signal<AdminUserSummary[]>([]);

  async ngOnInit() {
    const result = await this.adminService.listUsers('', 1, 10);
    this.users.set(result.users);
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
