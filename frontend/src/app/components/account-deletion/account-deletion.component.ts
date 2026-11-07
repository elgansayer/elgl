import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
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
  private i18n = inject(I18nService);
  readonly isLoading = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly deletionScheduled = signal<string | null>(null);

  async requestDeletion(): Promise<void> {
    const confirm = window.confirm(this.i18n.translate('account_deletion.confirmDelete'));
    if (!confirm) return;

    this.isLoading.set(true);
    this.message.set('');
    this.isError.set(false);

    try {
      const res = await this.userService.deleteMyAccount();
      this.deletionScheduled.set(res.scheduled_for_deletion_at);
      this.message.set(res.message);
    } catch {
      this.message.set(this.i18n.translate('account_deletion.requestFailed'));
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
      this.message.set(this.i18n.translate('account_deletion.restoreFailed'));
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
      this.message.set(this.i18n.translate('account_deletion.exportSuccess'));
    } catch {
      this.message.set(this.i18n.translate('account_deletion.exportFailed'));
      this.isError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
