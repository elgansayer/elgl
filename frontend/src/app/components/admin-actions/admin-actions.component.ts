import { Component, inject, signal, OnInit } from '@angular/core';
import { AdminService, AdminUserSummary } from '../../services/admin.service';

@Component({
  selector: 'app-admin-actions',
  standalone: true,
  template: `
    <div class="admin-actions">
      <h2>One‑click moderation</h2>
      <ul>
        @for (user of users(); track user.id) {
          <li>
            <span>{{ user.display_name ?? user.id }}</span>
            <button (click)="ban(user.id)">Ban</button>
            <button (click)="warn(user.id)">Warn</button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .admin-actions { margin: 16px; }
    button { margin-left: 8px; }
  `],
})
export class AdminActionsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly users = signal<AdminUserSummary[]>([]);

  async ngOnInit() {
    const result = await this.adminService.listUsers('', 1, 10);
    this.users.set(result.users);
  }

  async ban(userId: string) {
    try {
      await this.adminService.banUser(userId);
      alert('User banned');
    } catch {
      alert('Ban failed');
    }
  }

  async warn(userId: string) {
    try {
      await this.adminService.warnUser(userId);
      alert('Warning issued');
    } catch {
      alert('Warning failed');
    }
  }
}
