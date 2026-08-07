import { Component, inject, signal, OnInit } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-admin-actions',
  imports: [TranslatePipe],
  template: `
<<<<<<< HEAD
    <div class="p-4">
      <h2 class="text-xl font-bold mb-4 text-text-primary">{{ 'moderation.quickActions' | t }}</h2>
      <ul class="space-y-2" role="list">
        @for (user of users(); track user.id) {
          <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-3">
            <span class="text-sm text-text-primary">{{ user.display_name ?? user.id }}</span>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="ban(user.id)"
                class="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-red-700 transition-colors"
                [attr.aria-label]="'admin.banBtn' | t"
              >{{ 'admin.banBtn' | t }}</button>
              <button
                type="button"
                (click)="warn(user.id)"
                class="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-700 transition-colors"
                [attr.aria-label]="'admin.warnBtn' | t"
              >{{ 'admin.warnBtn' | t }}</button>
            </div>
=======
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
>>>>>>> origin/main
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
