import { Component, Input, inject } from '@angular/core';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-user-actions',
  standalone: true,
  template: `
    <div class="flex gap-2">
      <button (click)="handleBan()" class="btn btn-danger">Ban</button>
      <button (click)="handleWarn()" class="btn btn-warning">Warn</button>
    </div>
  `,
})
export class AdminUserActionsComponent {
  @Input({ required: true }) userId!: string;

  private adminService = inject(AdminService);

  async handleBan(): Promise<void> {
    if (!this.userId) return;
    try {
      await this.adminService.banUser(this.userId);
      // Optionally show a toast or refresh the list
    } catch (error) {
      console.error('Ban failed', error);
    }
  }

  async handleWarn(): Promise<void> {
    if (!this.userId) return;
    try {
      await this.adminService.warnUser(this.userId);
    } catch (error) {
      console.error('Warn failed', error);
    }
  }
}
