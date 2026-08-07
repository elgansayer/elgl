import { Component, inject, input, output, signal } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { EconomyStore } from '../../services/economy.store';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-trust-safety-modal',
  imports: [FormsModule, TranslatePipe, AppSkeletonLoaderComponent],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      (click)="closed.emit()"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 [id]="titleId" class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>{{ 'safety.title' | t }}</span>
            </h3>
            <p [id]="subtitleId" class="text-xs text-text-secondary">
              {{ 'safety.subtitle' | t: { name: targetName() } }}
            </p>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold p-2 -me-2 rounded-full hover:bg-surface-100 transition-colors"
            [attr.aria-label]="'safety.closeBtn' | t"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex rounded-2xl bg-surface-100 p-1 gap-1" role="tablist" [attr.aria-label]="'safety.tabGroupLabel' | t">
          <button
            role="tab"
            [attr.aria-selected]="mode() === 'report'"
            [attr.aria-controls]="reportPanelId"
            [id]="reportTabId"
            (click)="mode.set('report')"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode() === 'report' ? 'bg-surface-200 text-primary shadow-sm' : 'text-text-secondary')
            "
          >
            {{ 'safety.tabReport' | t }}
          </button>
          <button
            role="tab"
            [attr.aria-selected]="mode() === 'block'"
            [attr.aria-controls]="blockPanelId"
            [id]="blockTabId"
            (click)="mode.set('block')"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode() === 'block' ? 'bg-red-600 text-white shadow-sm' : 'text-text-secondary')
            "
          >
            {{ 'safety.tabBlock' | t }}
          </button>
        </div>

        @if (mode() === 'report') {
          <div [id]="reportPanelId" role="tabpanel" [attr.aria-labelledby]="reportTabId" class="space-y-3 text-xs">
            @if (categoriesLoading()) {
              <div class="space-y-2">
                <app-skeleton-loader [height]="'12px'" [width]="'60%'" [variant]="'text'" />
                <app-skeleton-loader [height]="'36px'" [width]="'100%'" [borderRadius]="'12px'" />
              </div>
            } @else {
              <div>
                <label for="report-reason-select" class="font-bold text-text-primary block mb-1 ps-1"
                  >{{ 'safety.reasonLabel' | t }}</label
                >
                <select
                  id="report-reason-select"
                  [(ngModel)]="reportReason"
                  class="w-full px-3 py-2 border rounded-xl bg-surface-300 font-medium"
                >
                  @for (cat of reportCategories(); track cat.value) {
                    <option [value]="cat.value">{{ cat.label }}</option>
                  }
                </select>
              </div>
            }
            <div>
              <label for="report-details-textarea" class="font-bold text-text-primary block mb-1 ps-1"
                >{{ 'safety.detailsLabel' | t }}</label
              >
              <textarea
                id="report-details-textarea"
                [(ngModel)]="reportDetails"
                rows="3"
                [placeholder]="'safety.detailsPlaceholder' | t"
                class="w-full p-3 border rounded-xl bg-surface-300"
              ></textarea>
            </div>
          </div>
        }

        @if (mode() === 'block') {
          <div
            [id]="blockPanelId"
            role="tabpanel"
            [attr.aria-labelledby]="blockTabId"
            class="bg-red-500/10 p-4 rounded-2xl border border-red-500/30 space-y-2 text-xs"
          >
            <span class="font-bold text-red-900 block"
              >{{ 'safety.blockWarning' | t: { name: targetName() } }}</span
            >
            <ul class="list-disc list-inside space-y-1 text-text-primary" role="list">
              <li>{{ 'safety.blockList1' | t }}</li>
              <li>{{ 'safety.blockList2' | t }}</li>
              <li>{{ 'safety.blockList3' | t }}</li>
            </ul>
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            type="button"
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs"
          >
            {{ 'safety.cancelBtn' | t }}
          </button>
          @if (mode() === 'report') {
            <button
              type="button"
              (click)="submitReport()"
              class="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-extrabold text-xs shadow"
            >
              {{ 'safety.submitReportBtn' | t }}
            </button>
          }
          @if (mode() === 'block') {
            <button
              type="button"
              (click)="confirmBlock()"
              class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-xs shadow"
            >
              {{ 'safety.confirmBlockBtn' | t }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class TrustSafetyModalComponent {
  readonly targetId = input.required<string>();
  readonly targetName = input.required<string>();
  readonly closed = output<void>();

  readonly titleId = 'trust-safety-modal-title';
  readonly subtitleId = 'trust-safety-modal-subtitle';
  readonly reportTabId = 'trust-safety-tab-report';
  readonly blockTabId = 'trust-safety-tab-block';
  readonly reportPanelId = 'trust-safety-panel-report';
  readonly blockPanelId = 'trust-safety-panel-block';

  private readonly store = inject(EconomyStore);
  private readonly safetyService = inject(SafetyService);

  readonly mode = signal<'report' | 'block'>('report');
  reportReason = 'harassment';
  reportDetails = '';

  readonly categoriesLoading = signal<boolean>(false);
  readonly reportCategories = signal<ReportCategory[]>([
    { value: 'harassment', label: 'Harassment / Bullying' },
    { value: 'spam', label: 'Spam / Commercial Advertising' },
    { value: 'inappropriate', label: 'Inappropriate / Offensive Language' },
    { value: 'scam', label: 'Suspicious Link / Scam' },
    { value: 'other', label: 'Other Violation' },
  ]);

  constructor() {
    this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    this.categoriesLoading.set(true);
    try {
      const cats = await this.safetyService.getReportCategories();
      if (cats.length > 0) {
        this.reportCategories.set(cats);
      }
    } catch {
      // Keep default categories
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  async submitReport(): Promise<void> {
    await this.store.reportUser(this.targetId(), this.reportReason, this.reportDetails);
    this.closed.emit();
  }

  async confirmBlock(): Promise<void> {
    await this.store.blockUser(this.targetId());
    this.closed.emit();
  }
}
