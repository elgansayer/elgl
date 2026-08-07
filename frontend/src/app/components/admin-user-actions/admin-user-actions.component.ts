import { Component, input, inject } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  imports: [TranslatePipe],
  selector: 'app-admin-user-actions',
  template: `
    <div class="flex gap-2">
      <button (click)="handleBan()" class="btn btn-danger">{{ 'components.admin-user-actions.ban' | t }}</button>
      <button (click)="handleWarn()" class="btn btn-warning">{{ 'components.admin-user-actions.warn' | t }}</button>
    </div>
  `,
})
export class AdminUserActionsComponent {
  userId = input.required<string>();

  private adminService = inject(AdminService);

  async handleBan(): Promise<void> {
    if (!this.userId()) return;
    try {
      await this.adminService.banUser(this.userId());
      // Optionally show a toast or refresh the list
    } catch (error) {
      console.error('Ban failed', error);
    }
  }

  async handleWarn(): Promise<void> {
    if (!this.userId()) return;
    try {
      await this.adminService.warnUser(this.userId());
    } catch (error) {
      console.error('Warn failed', error);
    }
  }
}
