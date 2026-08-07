import { Component, input, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-user-actions',
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2">
      <button
        (click)="handleBan()"
        class="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-red-700 transition-colors whitespace-nowrap"
      >{{ 'admin.banBtn' | t }}</button>
      <button
        (click)="handleWarn()"
        class="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-700 transition-colors whitespace-nowrap"
      >{{ 'admin.warnBtn' | t }}</button>
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
