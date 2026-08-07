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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ban failed';
      console.warn('Ban failed', message);
    }
  }

  async handleWarn(): Promise<void> {
    if (!this.userId()) return;
    try {
      await this.adminService.warnUser(this.userId());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Warn failed';
      console.warn('Warn failed', message);
    }
  }
}
