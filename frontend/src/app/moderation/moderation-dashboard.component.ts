import { Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';
import { ModerationItem, ModerationService } from '../services/moderation.service';
import { OfflineModerationService } from '../services/offline-moderation.service';

@Component({
  selector: 'app-moderation-dashboard',
  standalone: true,
  imports: [TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
  templateUrl: './moderation-dashboard.component.html',
})
export class ModerationDashboardComponent {
  private moderationService = inject(ModerationService);
  readonly offlineModeration = inject(OfflineModerationService);

  readonly type = signal<'moment' | 'profile'>('profile');

  readonly items = this.moderationService.getItemsResource(this.type);

  readonly analysis = signal<{
    riskScore: number;
    flags: string[];
    userId: string;
  } | null>(null);

  readonly actionInProgress = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly showCachedFallback = signal(false);
  readonly displayedItems = signal<ModerationItem[]>([]);
  private itemsReloadSignal = signal(0);

  constructor() {
    effect(() => {
      const onlineItems = this.items.value();
      void this.itemsReloadSignal();
      void this.type();

      if (onlineItems && onlineItems.length > 0) {
        this.showCachedFallback.set(false);
        this.displayedItems.set(onlineItems);
        this.offlineModeration.cacheItems(this.type(), onlineItems).catch(() => undefined);
        return;
      }
      this.offlineModeration.getCachedItems(this.type()).then((cached) => {
        if (cached.length > 0 && (!onlineItems || onlineItems.length === 0)) {
          this.showCachedFallback.set(true);
          this.displayedItems.set(cached);
        } else {
          this.displayedItems.set(onlineItems ?? []);
        }
      }).catch(() => undefined);
    });
  }

  private triggerReloadRefresh(): void {
    setTimeout(() => this.itemsReloadSignal.update((n) => n + 1), 100);
  }

  async approve(item: ModerationItem): Promise<void> {
    this.actionInProgress.set(item.id);
    this.actionError.set(null);
    try {
      if (this.offlineModeration.isOfflineMode()) {
        await this.offlineModeration.enqueuePendingAction('approve', item.id, item.type);
        this.displayedItems.update((list) => list.filter((i) => i.id !== item.id));
        return;
      }
      const result = await this.moderationService.approveItem(item.id, item.type);
      if (result.success) {
        this.items.reload();
        this.triggerReloadRefresh();
      } else {
        this.actionError.set(result.error ?? 'Failed to approve item');
      }
    } catch {
      this.actionError.set('Service temporarily unavailable');
    } finally {
      this.actionInProgress.set(null);
    }
  }

  async reject(item: ModerationItem): Promise<void> {
    this.actionInProgress.set(item.id);
    this.actionError.set(null);
    try {
      if (this.offlineModeration.isOfflineMode()) {
        await this.offlineModeration.enqueuePendingAction('reject', item.id, item.type);
        this.displayedItems.update((list) => list.filter((i) => i.id !== item.id));
        return;
      }
      const result = await this.moderationService.rejectItem(item.id, item.type);
      if (result.success) {
        this.items.reload();
        this.triggerReloadRefresh();
      } else {
        this.actionError.set(result.error ?? 'Failed to reject item');
      }
    } catch {
      this.actionError.set('Service temporarily unavailable');
    } finally {
      this.actionInProgress.set(null);
    }
  }

  async analyse(item: ModerationItem): Promise<void> {
    const userId = item.reported_user?.id;
    if (!userId || this.offlineModeration.isOfflineMode()) return;
    this.actionInProgress.set(item.id);
    this.actionError.set(null);
    try {
      const result = await this.moderationService.getUserRiskAnalysis(userId);
      this.analysis.set({
        riskScore: result.riskScore,
        flags: result.flags,
        userId,
      });
    } catch {
      this.actionError.set('Failed to analyse user');
    } finally {
      this.actionInProgress.set(null);
    }
  }

  async syncPendingActions(): Promise<void> {
    const result = await this.offlineModeration.syncPendingActions(async (action) => {
      if (action.actionType === 'approve') {
        return this.moderationService.approveItem(action.itemId, action.itemType);
      }
      return this.moderationService.rejectItem(action.itemId, action.itemType, action.reason);
    });
    if (result.succeeded > 0) {
      this.items.reload();
    }
    if (result.failed > 0) {
      this.actionError.set('Some actions failed to sync');
    }
  }
}
