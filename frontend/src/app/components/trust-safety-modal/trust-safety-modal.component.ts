import { Component, inject, input, output, signal } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-trust-safety-modal',
  imports: [FormsModule, TranslatePipe, CdkTrapFocus],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        (click)="close()"
        (keydown.escape)="close()"
        tabindex="-1"
      >
        <div
          class="w-full sm:max-w-md mx-auto bg-[#121212] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-800 max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="descriptionId"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-slate-800/50 shrink-0">
            <div>
              <h2 [id]="titleId" class="text-xl font-bold text-slate-100">
                {{ 'safety.title' | t }}
              </h2>
              <p [id]="descriptionId" class="text-xs text-slate-400 mt-1">
                {{ 'safety.subtitle' | t: { name: targetName() } }}
              </p>
            </div>
            <button
              type="button"
              class="text-slate-500 hover:text-slate-300 transition-colors p-2 -me-2 rounded-full hover:bg-slate-800"
              (click)="close()"
              [attr.aria-label]="'safety.closeBtn' | t"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Mode toggle -->
          <div
            class="flex rounded-2xl bg-slate-800/40 mx-5 mt-5 p-1 gap-1"
            role="tablist"
            [attr.aria-label]="'safety.modeLabel' | t"
          >
            <button
              (click)="setMode('report')"
              role="tab"
              [attr.aria-selected]="mode() === 'report'"
              [attr.aria-label]="'safety.tabReport' | t"
              [class]="
                'flex-1 py-2 rounded-xl text-sm font-bold transition-all ' +
                (mode() === 'report'
                  ? 'bg-red-500/20 text-red-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-300')
              "
            >
              {{ 'safety.tabReport' | t }}
            </button>
            <button
              (click)="setMode('block')"
              role="tab"
              [attr.aria-selected]="mode() === 'block'"
              [attr.aria-label]="'safety.tabBlock' | t"
              [class]="
                'flex-1 py-2 rounded-xl text-sm font-bold transition-all ' +
                (mode() === 'block'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300')
              "
            >
              {{ 'safety.tabBlock' | t }}
            </button>
          </div>

          <div class="p-5 overflow-y-auto overscroll-contain">
            @if (mode() === 'report') {
              <div class="space-y-4">
                <div>
                  <label for="safety-report-reason" class="block text-sm font-bold text-slate-300 mb-3 ps-1">
                    {{ 'safety.reasonLabel' | t }}
                  </label>
                  <select
                    id="safety-report-reason"
                    [(ngModel)]="reportReason"
                    class="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                  >
                    <option value="harassment">{{ 'safety.optHarassment' | t }}</option>
                    <option value="spam">{{ 'safety.optSpam' | t }}</option>
                    <option value="inappropriate">{{ 'safety.optInappropriate' | t }}</option>
                    <option value="scam">{{ 'safety.optScam' | t }}</option>
                    <option value="other">{{ 'safety.optOther' | t }}</option>
                  </select>
                </div>

                <div>
                  <label for="safety-report-details" class="block text-sm font-bold text-slate-300 mb-3 ps-1">
                    {{ 'safety.detailsLabel' | t }}
                  </label>
                  <textarea
                    id="safety-report-details"
                    [(ngModel)]="reportDetails"
                    rows="3"
                    [placeholder]="'safety.detailsPlaceholder' | t"
                    class="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 resize-none text-sm transition-all"
                  ></textarea>
                </div>
              </div>
            }

            @if (mode() === 'block') {
              <div
                class="bg-red-500/10 p-5 rounded-2xl border border-red-500/30 space-y-3"
                role="alert"
              >
                <span class="font-bold text-red-400 block text-sm">
                  {{ 'safety.blockWarning' | t: { name: targetName() } }}
                </span>
                <ul
                  class="list-disc list-inside space-y-2 text-slate-300 text-sm"
                  [attr.aria-label]="'safety.blockConsequencesLabel' | t"
                >
                  <li>{{ 'safety.blockList1' | t }}</li>
                  <li>{{ 'safety.blockList2' | t }}</li>
                  <li>{{ 'safety.blockList3' | t }}</li>
                </ul>
              </div>
            }
          </div>

          <!-- Actions -->
          <div class="p-5 border-t border-slate-800/50 shrink-0 flex gap-3">
            <button
              type="button"
              class="flex-1 py-3.5 rounded-full text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              (click)="close()"
            >
              {{ 'safety.cancelBtn' | t }}
            </button>
            @if (mode() === 'report') {
              <button
                type="button"
                (click)="submitReport()"
                class="flex-1 py-3.5 rounded-full text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-900/20"
              >
                {{ 'safety.submitReportBtn' | t }}
              </button>
            }
            @if (mode() === 'block') {
              <button
                type="button"
                (click)="confirmBlock()"
                class="flex-1 py-3.5 rounded-full text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-900/20"
              >
                {{ 'safety.confirmBlockBtn' | t }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class TrustSafetyModalComponent {
  targetId = input.required<string>();
  targetName = input.required<string>();
  closed = output<void>();

  readonly store = inject(EconomyStore);

  readonly titleId = 'trust-safety-modal-title';
  readonly descriptionId = 'trust-safety-modal-description';

  readonly isOpen = signal(true);
  readonly mode = signal<'report' | 'block'>('report');
  reportReason = 'harassment';
  reportDetails = '';

  setMode(mode: 'report' | 'block'): void {
    this.mode.set(mode);
  }

  close(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }

  async submitReport(): Promise<void> {
    await this.store.reportUser(this.targetId(), this.reportReason, this.reportDetails);
    this.close();
  }

  async confirmBlock(): Promise<void> {
    await this.store.blockUser(this.targetId());
    this.close();
  }
}
