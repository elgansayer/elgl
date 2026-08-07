import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';
import { ModerationItem, ModerationService } from './moderation.service';

@Component({
  selector: 'app-moderation-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="ps-4 pe-4 pt-4 pb-4">
      <h2 class="text-2xl font-bold mb-4">{{ 'moderation.title' | t }}</h2>

      <div class="flex gap-2 mb-4">
        <button
          type="button"
          class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          (click)="type.set('profile')"
        >
          {{ 'moderation.profile' | t }}
        </button>
        <button
          type="button"
          class="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300"
          (click)="type.set('moment')"
        >
          {{ 'moderation.moment' | t }}
        </button>
      </div>

      @if (items.isLoading()) {
        <p class="text-slate-500">{{ 'moderation.loading' | t }}</p>
      } @else if (items.error()) {
        <p class="text-red-500">{{ 'moderation.error' | t }}</p>
      } @else {
        @for (item of items.value(); track item.id) {
          <div class="border border-slate-200 rounded-lg p-4 mb-2">
            <p class="text-sm text-slate-500">
              {{ 'moderation.reporter' | t }}: {{ item.reporter?.display_name }}
            </p>
            <p class="text-sm text-slate-500">
              {{ 'moderation.reported_user' | t }}: {{ item.reported_user?.display_name }}
            </p>
            <p class="text-sm text-slate-500">
              {{ 'moderation.reason' | t }}: {{ item.reason }}
            </p>

            @if (analysis()?.userId === item.reported_user?.id) {
              <div class="mt-3 p-3 rounded bg-amber-50 border border-amber-300">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold">{{ 'moderation.riskScore' | t }}:</span>
                  <span class="text-sm font-mono">{{ analysis()?.riskScore }}</span>
                </div>
                @if (analysis()?.flags?.length) {
                  <div class="mt-1 flex flex-wrap gap-1">
                    @for (flag of analysis()?.flags ?? []; track flag) {
                      <span class="text-xs bg-rose-100 text-rose-800 rounded px-2 py-0.5">
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
                class="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
                (click)="approve(item)"
              >
                {{ 'moderation.approve' | t }}
              </button>
              <button
                type="button"
                class="rounded bg-rose-600 px-3 py-1 text-white hover:bg-rose-700"
                (click)="reject(item)"
              >
                {{ 'moderation.reject' | t }}
              </button>
              <button
                type="button"
                class="rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100"
                (click)="analyse(item)"
              >
                {{ 'moderation.analyse' | t }}
              </button>
            </div>
          </div>
        } @empty {
          <p class="text-slate-500">{{ 'moderation.empty' | t }}</p>
        }
      }
    </div>
  `,
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

  async approve(item: ModerationItem): Promise<void> {
    try {
      await this.moderationService.approveItem(item.id, item.type);
      this.items.reload();
    } catch (err) {
      console.warn('Approve failed', err);
    }
  }

  async reject(item: ModerationItem): Promise<void> {
    try {
      await this.moderationService.rejectItem(item.id, item.type);
      this.items.reload();
    } catch (err) {
      console.warn('Reject failed', err);
    }
  }

  async analyse(item: ModerationItem): Promise<void> {
    const userId = item.reported_user?.id;
    if (!userId) return;
    try {
      const result = await this.moderationService.analyseUser(userId);
      this.analysis.set({
        riskScore: result.riskScore,
        flags: result.flags,
        userId,
      });
    } catch (err) {
      console.warn('Analyse failed', err);
    }
  }
}
