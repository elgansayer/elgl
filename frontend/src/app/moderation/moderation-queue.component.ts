import { Component, inject, signal, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ModerationService,
  ModerationItem,
  UserAnalysisResult,
} from '../services/moderation.service';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
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
                <span class="font-semibold">{{ 'moderation.reason' | t }}: {{ item.reason }}</span>
                <span class="text-sm text-muted">{{ item.created_at | date: 'medium' }}</span>
              </div>

              @if (item.type === 'profile' && item.reported_user) {
                <p>{{ 'moderation.user' | t }}: {{ item.reported_user.display_name }}</p>
                <button
                  class="mt-2 rounded bg-secondary px-3 py-1"
                  (click)="analyse(item)"
                  [disabled]="analysisLoading()"
                >
                  {{ 'moderation.analyse' | t }}
                </button>
              }

              @if (item.type === 'moment' && item.moment_content) {
                <p>{{ 'moderation.content' | t }}: {{ item.moment_content }}</p>
              }

              @if (item.description) {
                <p>{{ 'moderation.description' | t }}: {{ item.description }}</p>
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
      if (!request) return firstValueFrom(this.moderationService.getItems('profile'));
      const type =
        request.type === 'moment' || request.type === 'profile' ? request.type : 'profile';
      return firstValueFrom(this.moderationService.getItems(type, request.status));
    },
  });

  readonly analysisResult = signal<UserAnalysisResult | null>(null);
  readonly analysisLoading = signal(false);

  setType(type: 'moment' | 'profile'): void {
    this.type.set(type);
    this.analysisResult.set(null);
  }

  setStatus(status: string): void {
    this.status.set(status || undefined);
  }

  async approve(item: ModerationItem): Promise<void> {
    await firstValueFrom(this.moderationService.approveItem(item.id, item.type));
    this.items.reload();
  }

  async reject(item: ModerationItem): Promise<void> {
    await firstValueFrom(this.moderationService.rejectItem(item.id, item.type));
    this.items.reload();
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
        await firstValueFrom(this.moderationService.getUserRiskAnalysis(userId)),
      );
    } finally {
      this.analysisLoading.set(false);
    }
  }
}
