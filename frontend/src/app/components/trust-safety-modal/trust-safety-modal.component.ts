import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslatePipe } from '../../services/translate.pipe';
import { SafetyService } from '../../services/safety.service';

@Component({
  selector: 'app-trust-safety-modal',
  imports: [FormsModule, TranslatePipe, CdkTrapFocus],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      (click)="closed.emit()"
      (keydown.escape)="closed.emit()"
      tabindex="-1"
    >
      <div
        class="w-full sm:max-w-md bg-[#121212] rounded-3xl shadow-2xl border border-slate-800 p-6 space-y-5"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-800/50 pb-3">
          <div>
            <h2 [id]="titleId" class="text-xl font-bold text-slate-100">
              {{ 'safety.title' | t }}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ 'safety.subtitle' | t: { name: targetName() } }}
            </p>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="text-slate-500 hover:text-slate-300 transition-colors p-2 -me-2 rounded-full hover:bg-slate-800"
            [attr.aria-label]="'safety.closeAria' | t"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tab buttons -->
        <div class="flex rounded-2xl bg-slate-800/40 p-1 gap-1" role="tablist" [attr.aria-label]="'safety.tabListAria' | t">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === 'report'"
            [attr.aria-controls]="reportPanelId"
            [class]="
              mode() === 'report'
                ? 'flex-1 py-1.5 rounded-xl text-xs font-bold bg-slate-700 text-red-400 shadow-sm'
                : 'flex-1 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-300'
            "
            (click)="mode.set('report')"
          >
            {{ 'safety.tabReport' | t }}
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === 'block'"
            [attr.aria-controls]="blockPanelId"
            [class]="
              mode() === 'block'
                ? 'flex-1 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-sm'
                : 'flex-1 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-300'
            "
            (click)="mode.set('block')"
          >
            {{ 'safety.tabBlock' | t }}
          </button>
        </div>

        <!-- Report panel -->
        @if (mode() === 'report') {
          <div [id]="reportPanelId" role="tabpanel" [attr.aria-labelledby]="titleId" class="space-y-4">
            <div>
              <label for="ts-report-reason" class="block text-sm font-bold text-slate-300 mb-2 ps-1">
                {{ 'safety.reasonLabel' | t }}
              </label>
              <select
                id="ts-report-reason"
                [(ngModel)]="reportReason"
                class="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
              >
                <option value="harassment">{{ 'safety.optHarassment' | t }}</option>
                <option value="spam">{{ 'safety.optSpam' | t }}</option>
                <option value="inappropriate">{{ 'safety.optInappropriate' | t }}</option>
                <option value="scam">{{ 'safety.optScam' | t }}</option>
                <option value="other">{{ 'safety.optOther' | t }}</option>
              </select>
            </div>
            <div>
              <label for="ts-report-details" class="block text-sm font-bold text-slate-300 mb-2 ps-1">
                {{ 'safety.detailsLabel' | t }}
              </label>
              <textarea
                id="ts-report-details"
                [(ngModel)]="reportDetails"
                rows="3"
                [placeholder]="'safety.detailsPlaceholder' | t"
                class="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none text-sm"
              ></textarea>
            </div>
          </div>
        }

        <!-- Block panel -->
        @if (mode() === 'block') {
          <div [id]="blockPanelId" role="tabpanel" [attr.aria-labelledby]="titleId">
            <div class="bg-red-500/10 p-4 rounded-2xl border border-red-500/30 space-y-2">
              <span class="font-bold text-red-400 text-sm block">
                {{ 'safety.blockWarning' | t: { name: targetName() } }}
              </span>
              <ul class="list-disc list-inside space-y-1 text-slate-300 text-xs">
                <li>{{ 'safety.blockList1' | t }}</li>
                <li>{{ 'safety.blockList2' | t }}</li>
                <li>{{ 'safety.blockList3' | t }}</li>
              </ul>
            </div>
          </div>
        }

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2 border-t border-slate-800/50">
          <button
            type="button"
            (click)="closed.emit()"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm text-slate-200 transition-colors"
          >
            {{ 'safety.cancelBtn' | t }}
          </button>
          @if (mode() === 'report') {
            <button
              type="button"
              [disabled]="isSubmitting()"
              (click)="submitReport()"
              class="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-900/20 transition-colors"
            >
              @if (isSubmitting()) {
                {{ 'safety.submittingBtn' | t }}
              } @else {
                {{ 'safety.submitReportBtn' | t }}
              }
            </button>
          }
          @if (mode() === 'block') {
            <button
              type="button"
              [disabled]="isSubmitting()"
              (click)="confirmBlock()"
              class="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-900/20 transition-colors"
            >
              @if (isSubmitting()) {
                {{ 'safety.submittingBtn' | t }}
              } @else {
                {{ 'safety.confirmBlockBtn' | t }}
              }
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

  private readonly safetyService = inject(SafetyService);

  readonly titleId = 'trust-safety-modal-title';
  readonly reportPanelId = 'trust-safety-report-panel';
  readonly blockPanelId = 'trust-safety-block-panel';

  readonly mode = signal<'report' | 'block'>('report');
  readonly isSubmitting = signal(false);
  reportReason = 'harassment';
  reportDetails = '';

  async submitReport(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      await this.safetyService.reportUserAsync({
        reported_id: this.targetId(),
        reason_category: this.reportReason,
        description: this.reportDetails || undefined,
      });
    } catch (e) {
      console.error('Failed to submit report:', e);
    } finally {
      this.isSubmitting.set(false);
      this.closed.emit();
    }
  }

  async confirmBlock(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      await this.safetyService.blockUserAsync(this.targetId());
    } catch (e) {
      console.error('Failed to block user:', e);
    } finally {
      this.isSubmitting.set(false);
      this.closed.emit();
    }
  }
}
