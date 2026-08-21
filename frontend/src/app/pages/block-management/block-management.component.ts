import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { BlockedUserResponse, BlockedUsersService } from '../../services/blocked-users.service';

@Component({
  selector: 'app-block-management',
  imports: [
    HlmButton,
    TranslatePipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
  ],
  templateUrl: './block-management.component.html',
  styles: [],
})
export class BlockManagementComponent {
  private readonly blockedUsersService = inject(BlockedUsersService);
  readonly blockedUsers = this.blockedUsersService.blockedUsers;
  readonly isLoading = this.blockedUsersService.isLoading;
  readonly loadError = this.blockedUsersService.error;

  hasTargetLanguages(user: BlockedUserResponse): boolean {
    return !!user.target_languages && user.target_languages.length > 0;
  }

  getTargetLanguagesText(user: BlockedUserResponse): string {
    if (!user.target_languages) return '';
    return user.target_languages.join(', ');
  }

  onUnblock(userId: string): void {
    void this.blockedUsersService.unblockUser(userId);
  }

  retryLoad(): void {
    void this.blockedUsersService.loadBlockedUsers();
  }
}
