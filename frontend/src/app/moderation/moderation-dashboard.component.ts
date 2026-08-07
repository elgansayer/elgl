import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../services/translate.pipe';
import { SanitiseHtmlPipe } from '../pipes/sanitise-html.pipe';
import { ModerationItem, ModerationService } from '../services/moderation.service';
import { AppEmptyStateComponent } from '../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../components/primitives/card/card.component';

@Component({
  selector: 'app-moderation-dashboard',
  standalone: true,
<<<<<<< HEAD
  imports: [CommonModule, TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
<<<<<<< HEAD
  template: `
    <div class="ps-4 pe-4 pt-4 pb-4" role="main" aria-labelledby="moderation-title">
      <h2 id="moderation-title" class="text-2xl font-bold mb-4">{{ 'moderation.title' | t }}</h2>

      <div class="flex gap-2 mb-4" role="tablist" [attr.aria-label]="'moderation.filterAria' | t">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="type() === 'profile'"
          class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          (click)="type.set('profile')"
        >
          {{ 'moderation.profile' | t }}
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="type() === 'moment'"
          class="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300"
          (click)="type.set('moment')"
        >
          {{ 'moderation.moment' | t }}
        </button>
      </div>

@if (actionError()) {
        <div class="mb-3 p-3 rounded bg-rose-50 border border-rose-300 text-rose-800 text-sm" role="alert">
          {{ actionError() }}
          <button
            type="button"
            class="ms-2 underline hover:no-underline"
            (click)="actionError.set(null)"
          >
            {{ 'moderation.dismiss' | t }}
          </button>
        </div>
      }

      <div aria-live="polite">
        @if (items.isLoading()) {
          <div class="space-y-3">
            @for (i of [1, 2, 3]; track i) {
              <app-card customClass="p-4 space-y-3">
                <div class="flex items-center gap-2">
                  <app-skeleton-loader [height]="'14px'" [width]="'40%'" [variant]="'text'" />
                  <app-skeleton-loader [height]="'14px'" [width]="'25%'" [variant]="'text'" />
                </div>
                <app-skeleton-loader [height]="'12px'" [width]="'60%'" [variant]="'text'" />
                <div class="flex gap-2 pt-1">
                  <app-skeleton-loader [height]="'32px'" [width]="'80px'" [borderRadius]="'8px'" />
                  <app-skeleton-loader [height]="'32px'" [width]="'80px'" [borderRadius]="'8px'" />
                  <app-skeleton-loader [height]="'32px'" [width]="'80px'" [borderRadius]="'8px'" />
                </div>
              </app-card>
            }
          </div>
        } @else if (items.error()) {
          <app-empty-state
            icon="\u26a0\ufe0f"
            [title]="'safety.moderation.loadError' | t"
            [description]="'safety.moderation.loadErrorDesc' | t"
            [actionLabel]="'common.retry' | t"
            (actionClicked)="items.reload()"
          />
        } @else {
          <div role="tabpanel" [attr.aria-label]="type() === 'profile' ? ('moderation.profile' | t) : ('moderation.moment' | t)">
          @for (item of items.value(); track item.id) {
            <div class="border border-slate-200 rounded-lg p-4 mb-2" [attr.aria-label]="'moderation.reportItemAria' | t: { id: item.id }">
              <p class="text-sm text-slate-500">
                <span class="sr-only">{{ 'moderation.reporter' | t }}: </span>{{ item.reporter?.display_name }}
              </p>
              <p class="text-sm text-slate-500">
                <span class="sr-only">{{ 'moderation.reported_user' | t }}: </span>{{ item.reported_user?.display_name }}
              </p>
              <p class="text-sm text-slate-500">
                <span class="sr-only">{{ 'moderation.reason' | t }}: </span>{{ item.reason }}
              </p>

              @if (analysis()?.userId === item.reported_user?.id) {
                <div class="mt-3 p-3 rounded bg-amber-50 border border-amber-300" role="region" [attr.aria-label]="'moderation.riskAnalysisAria' | t">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold">{{ 'moderation.riskScore' | t }}:</span>
                    <span class="text-sm font-mono" role="meter" [attr.aria-valuenow]="analysis()?.riskScore" aria-valuemin="0" aria-valuemax="100">{{ analysis()?.riskScore }}</span>
                  </div>
                  @if (analysis()?.flags?.length) {
                    <div class="mt-1 flex flex-wrap gap-1" role="list" [attr.aria-label]="'moderation.flags' | t">
                      @for (flag of analysis()?.flags ?? []; track flag) {
                        <span class="text-xs bg-rose-100 text-rose-800 rounded px-2 py-0.5" role="listitem">
                          {{ flag }}
                        </span>
                      }
                    </div>
                  } @else {
                    <span class="text-xs text-slate-600">{{ 'moderation.noFlags' | t }}</span>
                  }
                </div>
              }

<div class="mt-3 flex gap-2 flex-wrap">
              <button
                type="button"
                class="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 disabled:opacity-50"
                [disabled]="actionInProgress() === item.id"
                [attr.aria-label]="'moderation.approveAria' | t: { id: item.id }"
                (click)="approve(item)"
              >
                {{ 'moderation.approve' | t }}
              </button>
              <button
                type="button"
                class="rounded bg-rose-600 px-3 py-1 text-white hover:bg-rose-700 disabled:opacity-50"
                [disabled]="actionInProgress() === item.id"
                [attr.aria-label]="'moderation.rejectAria' | t: { id: item.id }"
                (click)="reject(item)"
              >
                {{ 'moderation.reject' | t }}
              </button>
              <button
                type="button"
                class="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                [disabled]="actionInProgress() === item.id"
                [attr.aria-label]="'moderation.analyseAria' | t: { user: item.reported_user?.display_name }"
                (click)="analyse(item)"
              >
                {{ 'moderation.analyse' | t }}
              </button>
            </div>
          </div>
          } @empty {
            <app-empty-state
              icon="\ud83d\udee1\ufe0f"
              [title]="'safety.moderation.emptyTitle' | t"
              [description]="'safety.moderation.emptyDesc' | t"
            />
          }
        </div>
        }
      </div>
    </div>
  `,
=======
=======
  imports: [CommonModule, TranslatePipe, SanitiseHtmlPipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
>>>>>>> origin/main
  templateUrl: './moderation-dashboard.component.html',
>>>>>>> origin/main
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
