import { Component, input, inject } from '@angular/core';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-user-actions',
  template: `
    <div class="flex gap-2">
      <button (click)="handleBan()" class="btn btn-danger">Ban</button>
      <button (click)="handleWarn()" class="btn btn-warning">Warn</button>
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
      console.warn('Ban failed', error);
    }
  }

  async handleWarn(): Promise<void> {
    if (!this.userId()) return;
    try {
      await this.adminService.warnUser(this.userId());
    } catch (error) {
      console.warn('Warn failed', error);
    }
  }
}
