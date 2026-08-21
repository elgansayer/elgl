import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { UserService } from '../../services/user.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-account-deletion',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './account-deletion.component.html',
  styleUrls: ['./account-deletion.component.scss'],
})
export class AccountDeletionComponent {
  private userService = inject(UserService);
  readonly isLoading = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly deletionScheduled = signal<string | null>(null);

  async requestDeletion(): Promise<void> {
    const confirm = window.confirm(
      'Are you sure you want to delete your account? This action can be undone within 30 days.',
    );
    if (!confirm) return;

    this.isLoading.set(true);
    this.message.set('');
    this.isError.set(false);

    try {
      const res = await this.userService.deleteMyAccount();
      this.deletionScheduled.set(res.scheduled_for_deletion_at);
      this.message.set(res.message);
    } catch {
      this.message.set('Failed to request deletion.');
      this.isError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async restoreAccount(): Promise<void> {
    this.isLoading.set(true);
    this.message.set('');
    this.isError.set(false);

    try {
      const res = await this.userService.restoreMyAccount();
      this.message.set(res.message);
      this.deletionScheduled.set(null);
    } catch {
      this.message.set('Failed to restore account.');
      this.isError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportData(): Promise<void> {
    this.isLoading.set(true);
    this.message.set('');
    this.isError.set(false);

    try {
      await this.userService.downloadMyData();
      this.message.set('Data export downloaded successfully.');
    } catch {
      this.message.set('Failed to export data.');
      this.isError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
