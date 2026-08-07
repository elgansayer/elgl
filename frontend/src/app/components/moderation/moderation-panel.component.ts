import { Component, inject, signal, resource, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
  templateUrl: './moderation-panel.html',
})
export class ModerationPanelComponent {
  private readonly moderationService = inject(ModerationService);

  currentFilter = signal<'moment' | 'profile'>('moment');
  loadError = signal<string | null>(null);
  analysisResult = signal<UserAnalysisResult | null>(null);
  analysing = signal(false);

  private readonly itemsResource = resource({
    params: () => ({ filter: this.currentFilter() }),
    loader: async ({ params }) => {
      this.loadError.set(null);
      try {
        return await this.moderationService.getItems(params.filter);
      } catch {
        this.loadError.set('Failed to load items');
        return [];
      }
    },
  });

  readonly items = computed(() => this.itemsResource.value() ?? []);
  readonly loading = this.itemsResource.isLoading;

  filterByType(type: 'moment' | 'profile') {
    this.currentFilter.set(type);
  }

  async approve(item: ModerationItem) {
    await this.moderationService.approveItem(item.id, item.type);
    this.itemsResource.reload();
  }

  async reject(item: ModerationItem) {
    await this.moderationService.rejectItem(item.id, item.type);
    this.itemsResource.reload();
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