import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, resource, ErrorHandler } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ModerationService,
  ModerationItem,
  ModerationActionResponse,
  UserAnalysisResult,
} from '../services/moderation.service';
import { OfflineAdminStorageService } from '../services/offline-admin-storage.service';
import { AdminOfflineBannerComponent } from '../components/admin-offline-banner/admin-offline-banner.component';
import { TranslatePipe } from '../services/translate.pipe';
import { SanitiseHtmlPipe } from '../pipes/sanitise-html.pipe';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';
import { CrashReportService } from '../services/crash-report.service';

@Component({
  selector: 'app-moderation-queue',
  imports: [
    HlmButton,
    DatePipe,
    TranslatePipe,
    SanitiseHtmlPipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
    AdminOfflineBannerComponent,
  ],
  templateUrl: './moderation-queue.component.html',
})
export class ModerationQueueComponent {
  private moderationService = inject(ModerationService);
  private offlineStorage = inject(OfflineAdminStorageService);
  private crashReportService = inject(CrashReportService);
  private errorHandler = inject(ErrorHandler);
  readonly isOnline = this.offlineStorage.isOnline;

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

  setStatus(newStatus: string): void {
    this.status.set(newStatus || undefined);
    // Clear analysis when switching status filter
    this.analysisResult.set(null);
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
    } catch (err: unknown) {
      this.actionError.set('Service temporarily unavailable');
      this.reportCrash(err, 'approve');
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
    } catch (err: unknown) {
      this.actionError.set('Service temporarily unavailable');
      this.reportCrash(err, 'reject');
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
      const result = await this.moderationService.getUserRiskAnalysis(userId);
      this.analysisResult.set(result);
    } catch (err: unknown) {
      this.actionError.set('Failed to analyse user');
      this.reportCrash(err, 'analyse');
    } finally {
      this.analysisLoading.set(false);
    }
  }

  private reportCrash(err: unknown, action: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.crashReportService.reportCrash(error, {
      route: typeof window !== 'undefined' ? window.location.href : '/admin/moderation',
      component: 'ModerationQueueComponent',
      adminRole: 'admin',
      offline: !this.isOnline(),
      action,
    });
    this.errorHandler.handleError(error);
  }
}
