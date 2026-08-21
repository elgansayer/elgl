import { Component, inject, resource, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-admin-actions',
  imports: [TranslatePipe, SanitiseHtmlPipe, ...HlmButtonImports],
  template: `
    <div class="m-4" role="region" [attr.aria-label]="'admin.quickModerationAria' | t">
      <h2>{{ 'admin.quickModeration' | t }}</h2>
      <ul role="list" class="space-y-2">
        @for (user of users(); track user.id) {
          <li class="flex flex-wrap items-center gap-2">
            <span class="me-auto">{{ (user.display_name ?? user.id) | sanitiseHtml }}</span>
            <button
              hlmBtn
              type="button"
              variant="destructive"
              size="sm"
              [attr.aria-label]="'admin.banUserAria' | t: { name: user.display_name ?? user.id }"
              (click)="ban(user.id)"
            >
              {{ 'admin.banBtn' | t }}
            </button>
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="sm"
              [attr.aria-label]="'admin.warnUserAria' | t: { name: user.display_name ?? user.id }"
              (click)="warn(user.id)"
            >
              {{ 'admin.warnBtn' | t }}
            </button>
          </li>
        }
      </ul>
    </div>
  `,
})
export class AdminActionsComponent {
  private readonly adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);

  private readonly usersResource = resource({
    params: () => ({ page: 1, pageSize: 10, search: '' }),
    loader: ({ params }) => this.adminService.listUsers(params.search, params.page, params.pageSize),
  });

  readonly users = computed(() => this.usersResource.value()?.users ?? []);

  async ban(userId: string): Promise<void> {
    try {
      await this.adminService.banUser(userId);
      showToast(this.i18n.translate('admin.userBanned'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.banFailed'));
    }
  }

  async warn(userId: string): Promise<void> {
    try {
      await this.adminService.warnUser(userId);
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    }
  }
}
