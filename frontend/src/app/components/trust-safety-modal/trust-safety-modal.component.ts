import { Component, inject, input, output } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-trust-safety-modal',
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>{{ 'safety.title' | t }}</span>
            </h3>
            <p class="text-xs text-text-secondary">
              {{ 'safety.subtitle' | t: { name: targetName() } }}
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
            [attr.aria-label]="'safety.closeBtn' | t"
          >
            ✕
          </button>
        </div>

        <div class="flex rounded-2xl bg-surface-100 p-1 gap-1">
          <button
            (click)="mode = 'report'"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode === 'report' ? 'bg-surface-200 text-primary shadow-sm' : 'text-text-secondary')
            "
          >
            {{ 'safety.tabReport' | t }}
          </button>
          <button
            (click)="mode = 'block'"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode === 'block' ? 'bg-red-600 text-white shadow-sm' : 'text-text-secondary')
            "
          >
            {{ 'safety.tabBlock' | t }}
          </button>
        </div>

        @if (mode === 'report') {
          <div class="space-y-3 text-xs">
            <div>
              <label for="report-reason-select" class="font-bold text-text-primary block mb-1 ps-1"
                >{{ 'safety.reasonLabel' | t }}</label
              >
              <select
                id="report-reason-select"
                [(ngModel)]="reportReason"
                class="w-full px-3 py-2 border rounded-xl bg-surface-300 font-medium"
              >
                <option value="harassment">{{ 'safety.optHarassment' | t }}</option>
                <option value="spam">{{ 'safety.optSpam' | t }}</option>
                <option value="inappropriate">{{ 'safety.optInappropriate' | t }}</option>
                <option value="scam">{{ 'safety.optScam' | t }}</option>
                <option value="other">{{ 'safety.optOther' | t }}</option>
              </select>
            </div>
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

        @if (mode === 'block') {
          <div class="bg-red-500/10 p-4 rounded-2xl border border-red-500/30 space-y-2 text-xs">
            <span class="font-bold text-red-900 block"
              >{{ 'safety.blockWarning' | t: { name: targetName() } }}</span
            >
            <ul class="list-disc list-inside space-y-1 text-text-primary">
              <li>{{ 'safety.blockList1' | t }}</li>
              <li>{{ 'safety.blockList2' | t }}</li>
              <li>{{ 'safety.blockList3' | t }}</li>
            </ul>
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs"
          >
            {{ 'safety.cancelBtn' | t }}
          </button>
          @if (mode === 'report') {
            <button
              (click)="submitReport()"
              class="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-extrabold text-xs shadow"
            >
              {{ 'safety.submitReportBtn' | t }}
            </button>
          }
          @if (mode === 'block') {
            <button
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
  targetId = input.required<string>();
  targetName = input.required<string>();
  closed = output<void>();

  readonly store = inject(EconomyStore);
  mode: 'report' | 'block' = 'report';
  reportReason = 'harassment';
  reportDetails = '';

  async submitReport(): Promise<void> {
    await this.store.reportUser(this.targetId(), this.reportReason, this.reportDetails);
    this.closed.emit();
  }

  async confirmBlock(): Promise<void> {
    await this.store.blockUser(this.targetId());
    this.closed.emit();
  }
}
