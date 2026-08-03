import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  BlockedUserResponse,
  BlockedUsersService,
} from '../../services/blocked-users.service';

@Component({
  selector: 'app-block-management',
  imports: [TranslatePipe],
  templateUrl: './block-management.component.html',
  styles: [],
})
export class BlockManagementComponent {
  private readonly blockedUsersService = inject(BlockedUsersService);
  readonly blockedUsers = this.blockedUsersService.blockedUsers;

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
}
