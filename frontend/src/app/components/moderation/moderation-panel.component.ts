import {Component, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitisePipe } from '../../services/sanitise.pipe';
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
  imports: [CommonModule, TranslatePipe, SanitisePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
  templateUrl: './moderation-panel.html',
})
export class ModerationPanelComponent {
  private readonly moderationService = inject(ModerationService);

  currentFilter = signal<'moment' | 'profile'>('moment');
  items = signal<ModerationItem[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  analysisResult = signal<UserAnalysisResult | null>(null);
  analysing = signal(false);

  constructor() {
    this.loadItems();
  }

  filterByType(type: 'moment' | 'profile') {
    this.currentFilter.set(type);
    this.loadItems();
  }

  private async loadItems() {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const items = await this.moderationService.getItems(this.currentFilter());
      this.items.set(items);
    } catch {
      this.loadError.set('Failed to load items');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async approve(item: ModerationItem) {
    await this.moderationService.approveItem(item.id, item.type);
    this.loadItems();
  }

  async reject(item: ModerationItem) {
    await this.moderationService.rejectItem(item.id, item.type);
    this.loadItems();
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
