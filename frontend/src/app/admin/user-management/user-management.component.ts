import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-management.component.html'
})
export class UserManagementComponent implements OnInit {
  private adminService = inject(AdminService);
  
  users = signal<any[]>([]);
  isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.adminService.listUsers('', 1, 50);
      this.users.set(data.users);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleVip(user: any): Promise<void> {
    const newVipStatus = !user.is_vip;
    const newTier = newVipStatus ? 'consumer_8_ukp_10_usd' : 'free';
    
    try {
      await this.adminService.setVipStatus(user.id, newVipStatus, newTier);
      await this.loadUsers(); // Reload to reflect changes
    } catch (err) {
      console.error('Failed to update VIP status', err);
    }
  }
}
