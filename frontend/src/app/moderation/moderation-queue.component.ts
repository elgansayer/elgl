import { Component, inject, signal, resource } from '@angular/core';
<<<<<<< HEAD
import { CommonModule } from '@angular/common';
=======
import { DatePipe } from '@angular/common';
>>>>>>> origin/main
import {
  ModerationService,
  ModerationItem,
  ModerationActionResponse,
  UserAnalysisResult,
} from '../services/moderation.service';
import { OfflineAdminStorageService } from '../services/offline-admin-storage.service';
import { AdminOfflineBannerComponent } from '../components/admin-offline-banner/admin-offline-banner.component';
import { TranslatePipe } from '../services/translate.pipe';
<<<<<<< HEAD
import { SanitisePipe } from '../services/sanitise.pipe';
=======
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';
>>>>>>> origin/main

@Component({
  selector: 'app-moderation-queue',
<<<<<<< HEAD
  standalone: true,
<<<<<<< HEAD
  imports: [CommonModule, TranslatePipe, SanitisePipe],
  template: `
    <div class="min-h-screen bg-surface p-6 text-on-surface">
      <h1 class="mb-4 text-2xl font-bold">{{ 'moderation.title' | t }}</h1>

      <div class="mb-4 flex gap-2">
        <button
          class="rounded-t-lg px-4 py-2"
          [class.bg-primary]="type() === 'profile'"
          (click)="setType('profile')"
        >
          {{ 'moderation.profiles' | t }}
        </button>
        <button
          class="rounded-t-lg px-4 py-2"
          [class.bg-primary]="type() === 'moment'"
          (click)="setType('moment')"
        >
          {{ 'moderation.moments' | t }}
        </button>
      </div>

      <div class="mb-4 flex gap-2">
        <button class="rounded px-3 py-1" [class.bg-primary]="!status()" (click)="setStatus('')">
          {{ 'moderation.all' | t }}
        </button>
        <button
          class="rounded px-3 py-1"
          [class.bg-primary]="status() === 'pending'"
          (click)="setStatus('pending')"
        >
          {{ 'moderation.pending' | t }}
        </button>
        <button
          class="rounded px-3 py-1"
          [class.bg-primary]="status() === 'approved'"
          (click)="setStatus('approved')"
        >
          {{ 'moderation.approved' | t }}
        </button>
        <button
          class="rounded px-3 py-1"
          [class.bg-primary]="status() === 'rejected'"
          (click)="setStatus('rejected')"
        >
          {{ 'moderation.rejected' | t }}
        </button>
      </div>

      @if (items.isLoading()) {
        <p>{{ 'moderation.loading' | t }}</p>
      } @else if (items.error()) {
        <p>{{ 'moderation.error' | t }}</p>
      } @else if (items.value()?.length === 0) {
        <p>{{ 'moderation.noItems' | t }}</p>
      } @else {
        <ul class="space-y-4">
          @for (item of items.value(); track item.id) {
            <li class="rounded bg-elevated p-4">
              <div class="flex items-center justify-between">
                <span class="font-semibold">{{ 'moderation.reason' | t }}: {{ item.reason | sanitise }}</span>
                <span class="text-sm text-muted">{{ item.created_at | date: 'medium' }}</span>
              </div>

              @if (item.type === 'profile' && item.reported_user) {
                <p>{{ 'moderation.user' | t }}: {{ item.reported_user.display_name | sanitise }}</p>
                <button
                  class="mt-2 rounded bg-secondary px-3 py-1"
                  (click)="analyse(item)"
                  [disabled]="analysisLoading()"
                >
                  {{ 'moderation.analyse' | t }}
                </button>
              }

              @if (item.type === 'moment' && item.moment_content) {
                <p>{{ 'moderation.content' | t }}: {{ item.moment_content | sanitise }}</p>
              }

              @if (item.description) {
                <p>{{ 'moderation.description' | t }}: {{ item.description | sanitise }}</p>
              }

              <div class="mt-4 flex gap-2">
                <button class="rounded bg-primary px-3 py-1" (click)="approve(item)">
                  {{ 'moderation.approve' | t }}
                </button>
                <button class="rounded bg-secondary px-3 py-1" (click)="reject(item)">
                  {{ 'moderation.reject' | t }}
                </button>
              </div>
            </li>
          }
        </ul>
      }

      @if (analysisResult()) {
        <section class="mt-6 rounded bg-elevated p-4">
          <h2 class="mb-2 text-lg font-semibold">
            {{ 'moderation.riskScore' | t }}: {{ analysisResult()?.riskScore }}%
          </h2>
          @if (analysisResult()?.flags?.length) {
            <p>{{ 'moderation.flags' | t }}: {{ analysisResult()?.flags?.join(', ') }}</p>
          } @else {
            <p>{{ 'moderation.noFlags' | t }}</p>
          }
          @if ((analysisResult()?.riskScore ?? 0) > 70) {
            <p class="mt-2 text-rose-500">{{ 'moderation.behaviourWarning' | t }}</p>
          }
        </section>
      }
    </div>
  `,
=======
=======
>>>>>>> origin/main
  imports: [
    DatePipe,
    TranslatePipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
    AdminOfflineBannerComponent,
  ],
  templateUrl: './moderation-queue.component.html',
>>>>>>> origin/main
})
export class ModerationQueueComponent {
  private moderationService = inject(ModerationService);
  private offlineStorage = inject(OfflineAdminStorageService);
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
      const result = await this.moderationService.getUserRiskAnalysis(userId);
      this.analysisResult.set(result);
    } catch {
      this.actionError.set('Failed to analyse user');
    } finally {
      this.analysisLoading.set(false);
    }
  }
}
