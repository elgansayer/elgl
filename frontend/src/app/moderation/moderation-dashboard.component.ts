import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';
import { ModerationItem, ModerationService } from './moderation.service';
import { AppCardComponent } from '../components/primitives/card/card.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-moderation-dashboard',
  imports: [
    CommonModule,
    TranslatePipe,
    AppCardComponent,
    AppSkeletonLoaderComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './moderation-dashboard.component.html',
})
export class ModerationDashboardComponent {
  private moderationService = inject(ModerationService);

  readonly type = signal<'moment' | 'profile'>('profile');

  readonly items = this.moderationService.getItemsResource(this.type);

  readonly analysis = signal<{
    riskScore: number;
    flags: string[];
    userId: string;
  } | null>(null);

  async approve(item: ModerationItem): Promise<void> {
    try {
      await this.moderationService.approveItem(item.id, item.type);
      this.items.reload();
    } catch (err) {
      console.warn('Approve failed', err);
    }
  }

  async reject(item: ModerationItem): Promise<void> {
    try {
      await this.moderationService.rejectItem(item.id, item.type);
      this.items.reload();
    } catch (err) {
      console.warn('Reject failed', err);
    }
  }

  async analyse(item: ModerationItem): Promise<void> {
    const userId = item.reported_user?.id;
    if (!userId) return;
    try {
      const result = await this.moderationService.analyseUser(userId);
      this.analysis.set({
        riskScore: result.riskScore,
        flags: result.flags,
        userId,
      });
    } catch (err) {
      console.warn('Analyse failed', err);
    }
  }
}
