import { HlmButton } from '@spartan-ng/helm/button';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';
import { SanitiseHtmlPipe } from '../pipes/sanitise-html.pipe';
import { ModerationItem, ModerationService } from '../services/moderation.service';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';

@Component({
  selector: 'app-moderation-dashboard',
  imports: [
    HlmButton,
    CommonModule,
    TranslatePipe,
    SanitiseHtmlPipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
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

  readonly actionInProgress = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  async approve(item: ModerationItem): Promise<void> {
    this.actionInProgress.set(item.id);
    this.actionError.set(null);
    try {
      const result = await this.moderationService.approveItem(item.id, item.type);
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
      const result = await this.moderationService.rejectItem(item.id, item.type);
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
    if (!userId) return;
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
}
