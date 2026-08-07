import { Component, inject, signal, resource, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ModerationService,
  ModerationItem,
  UserAnalysisResult,
} from '../services/moderation.service';
import { OfflineModerationService } from './offline-moderation.service';
import { TranslatePipe } from '../services/translate.pipe';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';
import { NoNetworkBannerComponent } from '../components/primitives/no-network-banner/no-network-banner.component';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
    NoNetworkBannerComponent,
  ],
  templateUrl: './moderation-queue.component.html',
})
export class ModerationQueueComponent {
  private moderationService = inject(ModerationService);
  readonly offlineModeration = inject(OfflineModerationService);

  readonly type = signal<'moment' | 'profile'>('profile');
  readonly status = signal<string | undefined>(undefined);

  /** IDs of items whose action was queued offline, for UI dimming */
  readonly offlineActionedIds = signal<Set<string>>(new Set());

  readonly items = resource({
    params: () => ({ type: this.type(), status: this.status() }),
    loader: (param: {
      request?: { type?: string; status?: string };
      params?: { type?: string; status?: string };
    }) => {
      const request = param.request ?? param.params;
      if (!request) return this.moderationService.getItems('profile');
      const type =
        request.type === 'moment' || request.type === 'profile' ? request.type : 'profile';
      return this.moderationService.getItems(type, request.status);
    },
  });

  readonly analysisResult = signal<UserAnalysisResult | null>(null);
  readonly analysisLoading = signal(false);

  constructor() {
    // When coming back online, sync and reload
    effect(() => {
      if (this.offlineModeration.isOnline) {
        this.offlineModeration.syncPendingActions().then(() => {
          this.offlineActionedIds.set(new Set());
          this.items.reload();
        });
      }
    });
  }

  itemOfflineActioned(itemId: string): boolean {
    return this.offlineActionedIds().has(itemId);
  }

  setType(type: 'moment' | 'profile'): void {
    this.type.set(type);
    this.analysisResult.set(null);
  }

  setStatus(status: string): void {
    this.status.set(status || undefined);
  }

  async approve(item: ModerationItem): Promise<void> {
    if (!this.offlineModeration.isOnline) {
      await this.offlineModeration.queueAction(item.id, 'approve', item.type);
      this.offlineActionedIds.update((s) => new Set(s).add(item.id));
      this.items.reload();
      return;
    }
    await this.moderationService.approveItem(item.id, item.type);
    this.items.reload();
  }

  async reject(item: ModerationItem): Promise<void> {
    if (!this.offlineModeration.isOnline) {
      await this.offlineModeration.queueAction(item.id, 'reject', item.type, 'Violation');
      this.offlineActionedIds.update((s) => new Set(s).add(item.id));
      this.items.reload();
      return;
    }
    await this.moderationService.rejectItem(item.id, item.type);
    this.items.reload();
  }

  async analyse(item: ModerationItem): Promise<void> {
    const userId = item.reported_user?.id;
    if (!userId) return;
    if (!this.offlineModeration.isOnline) return;
    this.analysisLoading.set(true);
    this.analysisResult.set(null);
    try {
      this.analysisResult.set(
        await this.moderationService.getUserRiskAnalysis(userId),
      );
    } finally {
      this.analysisLoading.set(false);
    }
  }
}
