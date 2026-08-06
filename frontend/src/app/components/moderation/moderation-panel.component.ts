import {Component, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  ModerationService,
  ModerationItem,
  UserAnalysisResult,
} from '../../services/moderation.service';

@Component({
  selector: 'app-moderation-panel',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './moderation-panel.html',
})
export class ModerationPanelComponent {
  private readonly moderationService = inject(ModerationService);

  currentFilter = signal<'moment' | 'profile'>('moment');
  items = signal<ModerationItem[]>([]);
  loading = signal(false);
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
    try {
      const items = await this.moderationService.getItems(this.currentFilter());
      this.items.set(items);
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
