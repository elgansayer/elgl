import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { BlockedUsersService } from '../../services/blocked-users.service';

@Component({
  selector: 'app-block-management',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './block-management.component.html',
  styles: [],
})
export class BlockManagementComponent {
  private readonly blockedUsersService = inject(BlockedUsersService);
  readonly blockedUsers = this.blockedUsersService.blockedUsers;

  onUnblock(userId: string): void {
    this.blockedUsersService.unblockUser(userId);
  }
}
