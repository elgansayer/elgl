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

  loadUsers(): void {
    this.isLoading.set(true);
    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.isLoading.set(false);
      }
    });
  }

  toggleVip(user: any): void {
    const newVipStatus = !user.is_vip;
    const newTier = newVipStatus ? 'consumer_8_ukp_10_usd' : 'free';
    
    this.adminService.updateVipStatus(user.id, newVipStatus, newTier).subscribe(() => {
      this.loadUsers(); // Reload to reflect changes
    });
  }
}
