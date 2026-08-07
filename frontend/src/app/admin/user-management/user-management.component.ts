import { Component, inject, signal } from '@angular/core';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-user-management',
  imports: [TranslatePipe],
  templateUrl: './user-management.component.html',
})
export class UserManagementComponent {
  private adminService = inject(AdminService);

  users = signal<AdminUserSummary[]>([]);
  isLoading = signal(true);

  constructor() {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.adminService.listUsers('', 1, 50);
      this.users.set(data.users);
    } catch (err) {
      console.warn('Failed to load users', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleVip(user: AdminUserSummary): Promise<void> {
    const newVipStatus = !user.is_vip;
    const newTier = newVipStatus ? 'consumer_8_ukp_10_usd' : 'free';

    try {
      await this.adminService.setVipStatus(user.id, newVipStatus, newTier);
      await this.loadUsers();
    } catch (err) {
      console.warn('Failed to update VIP status', err);
    }
  }
}
