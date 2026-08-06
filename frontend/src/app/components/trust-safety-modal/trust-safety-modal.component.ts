import { Component, inject, input, output } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { SafetyService } from '../../services/safety.service';

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
              <span>🛡️ Trust and safety moderation</span>
            </h3>
            <p class="text-xs text-text-secondary">
              Report or block {{ targetName() }} to keep our community safe
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
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
            ⚠️ Report user
          </button>
          <button
            (click)="mode = 'block'"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode === 'block' ? 'bg-red-600 text-white shadow-sm' : 'text-text-secondary')
            "
          >
            🚫 Block user
          </button>
        </div>

        @if (mode === 'report') {
          <div class="space-y-3 text-xs">
            <div>
              <label for="report-reason-select" class="font-bold text-text-primary block mb-1"
                >Select violation category:</label
              >
              <select
                id="report-reason-select"
                [(ngModel)]="reportReason"
                class="w-full px-3 py-2 border rounded-xl bg-surface-300 font-medium"
              >
                <option value="harassment">Harassment / Bullying</option>
                <option value="spam">Spam / Commercial Advertising</option>
                <option value="inappropriate">Inappropriate / Offensive Language</option>
                <option value="scam">Suspicious Link / Scam</option>
                <option value="other">Other Violation</option>
              </select>
            </div>
            <div>
              <label for="report-details-textarea" class="font-bold text-text-primary block mb-1"
                >Additional context (optional):</label
              >
              <textarea
                id="report-details-textarea"
                [(ngModel)]="reportDetails"
                rows="3"
                placeholder="Provide context or specific phrase where violation occurred..."
                class="w-full p-3 border rounded-xl bg-surface-300"
              ></textarea>
            </div>
          </div>
        }

        @if (mode === 'block') {
          <div class="bg-red-500/10 p-4 rounded-2xl border border-red-500/30 space-y-2 text-xs">
            <span class="font-bold text-red-900 block"
              >⚠️ What happens when you block {{ targetName() }}:</span
            >
            <ul class="list-disc list-inside space-y-1 text-text-primary">
              <li>They will not be able to send you direct chat messages.</li>
              <li>Their Moments will immediately vanish from your timeline.</li>
              <li>They cannot see when you visit their profile.</li>
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
              Submit report
            </button>
          }
          @if (mode === 'block') {
            <button
              (click)="confirmBlock()"
              class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-xs shadow"
            >
              Confirm block
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
  mode: 'report' | 'block' = 'report';
  reportReason = 'harassment';
  reportDetails = '';

  async submitReport(): Promise<void> {
    await this.safetyService.reportUser({
      reported_id: this.targetId(),
      reason_category: this.reportReason,
      description: this.reportDetails,
    });
    this.closed.emit();
  }

  async confirmBlock(): Promise<void> {
    await this.safetyService.blockUserAsync(this.targetId());
    this.closed.emit();
  }
}
