import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, resource, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
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
  imports: [
    HlmButton,
    CommonModule,
    TranslatePipe,
    SanitiseHtmlPipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
  ],
  templateUrl: './moderation-panel.html',
})
export class ModerationPanelComponent {
  private readonly moderationService = inject(ModerationService);

  readonly currentFilter = signal<'moment' | 'profile'>('moment');

  private readonly itemsResource = resource({
    params: () => ({ filter: this.currentFilter() }),
    loader: ({ params }) => this.moderationService.getItems(params.filter),
  });

  readonly items = computed(() => this.itemsResource.value() ?? []);
  readonly loading = this.itemsResource.isLoading;
  readonly loadError = computed(() => {
    const error = this.itemsResource.error() as string | undefined;
    return error ?? null;
  });

  readonly analysisResult = signal<UserAnalysisResult | null>(null);
  readonly analysing = signal(false);

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
