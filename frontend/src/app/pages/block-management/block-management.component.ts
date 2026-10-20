import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
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
  private readonly location = inject(Location);

  readonly blockedUsers = this.blockedUsersService.blockedUsers;
  readonly isLoading = this.blockedUsersService.isLoading;
  readonly loadError = this.blockedUsersService.error;
  readonly unblockError = this.blockedUsersService.unblockError;
  readonly confirmUnblockId = signal<string | null>(null);

  hasTargetLanguages(user: BlockedUserResponse): boolean {
    return !!user.target_languages && user.target_languages.length > 0;
  }

  getTargetLanguagesText(user: BlockedUserResponse): string {
    if (!user.target_languages) return '';
    return user.target_languages.join(', ');
  }

  requestUnblock(userId: string): void {
    if (!userId || this.isUnblocking(userId)) return;
    this.blockedUsersService.clearUnblockError();
    this.confirmUnblockId.set(userId);
  }

  cancelUnblock(): void {
    this.blockedUsersService.clearUnblockError();
    this.confirmUnblockId.set(null);
  }

  async confirmUnblock(userId: string): Promise<void> {
    if (this.confirmUnblockId() !== userId || this.isUnblocking(userId)) return;
    try {
      await this.blockedUsersService.unblockUser(userId);
      this.confirmUnblockId.set(null);
    } catch {
      // The service exposes a privacy-safe failure state and keeps the row for retry.
    }
  }

  isUnblocking(userId: string): boolean {
    return this.blockedUsersService.isUnblocking(userId);
  }

  retryLoad(): void {
    void this.blockedUsersService.loadBlockedUsers();
  }

  goBack(): void {
    this.location.back();
  }
}
