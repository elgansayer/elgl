import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { BlockService, BlockedUser } from '../../services/block.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-block-management',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './block-management.component.html',
})
export class BlockManagementComponent {
  private blockService = inject(BlockService);

  protected blockedUsers = toSignal(this.blockService.getBlockedUsers(), {
    initialValue: [] as BlockedUser[],
  });

  protected async onUnblock(userId: string) {
    try {
      const result = await firstValueFrom(this.blockService.unblockUser(userId));
      if (result.success) {
        this.blockedUsers.update((list) => list.filter((u) => u.id !== userId));
      }
    } catch (err) {
      console.error(err);
    }
  }
}
