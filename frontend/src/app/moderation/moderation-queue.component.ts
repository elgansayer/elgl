import { Component, inject, signal, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ModerationService,
  ModerationItem,
  ModerationActionResponse,
  UserAnalysisResult,
} from '../services/moderation.service';
import { TranslatePipe } from '../services/translate.pipe';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
  ],
  templateUrl: './moderation-queue.component.html',
})
export class ModerationQueueComponent {
  private moderationService = inject(ModerationService);

  readonly type = signal<'moment' | 'profile'>('profile');
  readonly status = signal<string | undefined>(undefined);

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
  readonly actionInProgress = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  setType(type: 'moment' | 'profile'): void {
    this.type.set(type);
    this.analysisResult.set(null);
  }

  setStatus(status: string): void {
    this.status.set(status || undefined);
  }

  async approve(item: ModerationItem): Promise<void> {
    this.actionInProgress.set(item.id);
    this.actionError.set(null);
    try {
      const result: ModerationActionResponse = await this.moderationService.approveItem(
        item.id,
        item.type,
      );
      if (result.success) {
        this.items.reload();
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
      const result: ModerationActionResponse = await this.moderationService.rejectItem(
        item.id,
        item.type,
      );
      if (result.success) {
        this.items.reload();
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
    if (!userId) {
      return;
    }
    this.analysisLoading.set(true);
    this.analysisResult.set(null);
    try {
      this.analysisResult.set(
        await this.moderationService.getUserRiskAnalysis(userId),
      );
    } catch {
      this.actionError.set('Failed to analyse user');
    } finally {
      this.analysisLoading.set(false);
    }
  }
}
