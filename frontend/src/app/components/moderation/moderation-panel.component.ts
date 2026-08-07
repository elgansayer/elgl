import { Component, computed, inject, resource, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../primitives/card/card.component';
import {
  ModerationService,
  ModerationItem,
  UserAnalysisResult,
} from '../../services/moderation.service';

@Component({
  selector: 'app-moderation-panel',
  imports: [TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
  templateUrl: './moderation-panel.html',
})
export class ModerationPanelComponent {
  private readonly moderationService = inject(ModerationService);

  readonly currentFilter = signal<'moment' | 'profile'>('moment');

  private readonly refreshToken = signal(0);

  private readonly itemsResource = resource({
    request: () => ({ filter: this.currentFilter(), refresh: this.refreshToken() }),
    loader: ({ request }) => this.moderationService.getItems(request.filter),
    defaultValue: [],
  });

  readonly items = this.itemsResource.value;
  readonly loading = this.itemsResource.isLoading;
  readonly loadError = computed(() =>
    this.itemsResource.error() ? 'Failed to load items' : null,
  );

  readonly analysisResult = signal<UserAnalysisResult | null>(null);
  readonly analysing = signal(false);

  filterByType(type: 'moment' | 'profile') {
    this.currentFilter.set(type);
  }

  async approve(item: ModerationItem) {
    await this.moderationService.approveItem(item.id, item.type);
    this.refreshToken.update((v) => v + 1);
  }

  async reject(item: ModerationItem) {
    await this.moderationService.rejectItem(item.id, item.type);
    this.refreshToken.update((v) => v + 1);
  }

  async analyseUserProfile(userId: string) {
    this.analysing.set(true);
    this.analysisResult.set(null);
    try {
      const result = await this.moderationService.getUserRiskAnalysis(userId);
      this.analysisResult.set(result);
    } finally {
      this.analysing.set(false);
    }
  }
}
