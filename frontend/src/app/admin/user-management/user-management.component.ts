import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-user-management',
  imports: [
    HlmButton,
    CommonModule,
    TranslatePipe,
    SanitiseHtmlPipe,
    AppCardComponent,
    AppSkeletonLoaderComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './user-management.component.html',
})
export class UserManagementComponent implements OnInit {
  private adminService = inject(AdminService);

  users = signal<AdminUserSummary[]>([]);
  isLoading = signal<boolean>(true);
  loadError = signal(false);

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.adminService.listUsers('', 1, 50);
      this.users.set(data.users);
    } catch (err) {
      this.loadError.set(true);
      console.error('Failed to load users', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleVip(user: AdminUserSummary): Promise<void> {
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
