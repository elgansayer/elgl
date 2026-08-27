import { Component, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';
import { BlockedUserResponse, BlockedUsersService } from '../../services/blocked-users.service';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-block-management',
  imports: [HlmButton, TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  templateUrl: './block-management.component.html',
  styles: [],
})
export class BlockManagementComponent {
  private readonly blockedUsersService = inject(BlockedUsersService);
  private readonly confirmService = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly blockedUsers = this.blockedUsersService.blockedUsers;
  readonly isLoading = this.blockedUsersService.isLoading;
  readonly loadError = this.blockedUsersService.error;
  readonly unblockingUserIds = this.blockedUsersService.unblockingUserIds;
  readonly unblockError = this.blockedUsersService.unblockError;

  hasTargetLanguages(user: BlockedUserResponse): boolean {
    return !!user.target_languages && user.target_languages.length > 0;
  }

  getTargetLanguagesText(user: BlockedUserResponse): string {
    if (!user.target_languages) return '';
    return user.target_languages.join(', ');
  }

  isUnblocking(userId: string): boolean {
    return this.unblockingUserIds().has(userId);
  }

  async onUnblock(user: BlockedUserResponse): Promise<void> {
    if (this.isUnblocking(user.id)) return;

    const name = user.display_name?.trim() || this.i18n.translate('common.unknownUser');
    const confirmed = await this.confirmService.confirm(
      this.i18n.translate('safety.blockManagement.unblockAria', { name }),
    );
    if (!confirmed) return;

    await this.blockedUsersService.unblockUser(user.id);
  }

  retryLoad(): void {
    void this.blockedUsersService.loadBlockedUsers();
  }
}
