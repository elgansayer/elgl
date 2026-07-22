import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-trust-safety-modal',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        class="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-fadeIn"
      >
        <div
          class="flex items-center justify-between border-b border-slate-100 pb-3"
        >
          <div>
            <h3 class="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>🛡️ Trust and safety moderation</span>
            </h3>
            <p class="text-xs text-slate-500">
              Report or block {{ targetName }} to keep our community safe
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-slate-400 hover:text-slate-600 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <div class="flex rounded-2xl bg-slate-100 p-1 gap-1">
          <button
            (click)="mode = 'report'"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode === 'report'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600')
            "
          >
            ⚠️ Report user
          </button>
          <button
            (click)="mode = 'block'"
            [class]="
              'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (mode === 'block'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600')
            "
          >
            🚫 Block user
          </button>
        </div>

        @if (mode === 'report') {
          <div class="space-y-3 text-xs">
            <div>
              <label for="report-reason-select" class="font-bold text-slate-700 block mb-1"
                >Select violation category:</label
              >
              <select
                id="report-reason-select"
                [(ngModel)]="reportReason"
                class="w-full px-3 py-2 border rounded-xl bg-slate-50 font-medium"
              >
                <option value="harassment">Harassment / Bullying</option>
                <option value="spam">Spam / Commercial Advertising</option>
                <option value="inappropriate">Inappropriate / Offensive Language</option>
                <option value="scam">Suspicious Link / Scam</option>
                <option value="other">Other Violation</option>
              </select>
            </div>
            <div>
              <label for="report-details-textarea" class="font-bold text-slate-700 block mb-1"
                >Additional context (optional):</label
              >
              <textarea
                id="report-details-textarea"
                [(ngModel)]="reportDetails"
                rows="3"
                placeholder="Provide context or specific phrase where violation occurred..."
                class="w-full p-3 border rounded-xl bg-slate-50"
              ></textarea>
            </div>
          </div>
        }

        @if (mode === 'block') {
          <div
            class="bg-red-50 p-4 rounded-2xl border border-red-200 space-y-2 text-xs"
          >
            <span class="font-bold text-red-900 block"
              >⚠️ What happens when you block {{ targetName }}:</span
            >
            <ul class="list-disc list-inside space-y-1 text-slate-700">
              <li>They will not be able to send you direct chat messages.</li>
              <li>Their Moments will immediately vanish from your timeline.</li>
              <li>They cannot see when you visit their profile.</li>
            </ul>
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            (click)="closed.emit()"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs"
          >
            Cancel
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
  @Input({ required: true }) targetId = '';
  @Input({ required: true }) targetName = 'User';
  @Output() closed = new EventEmitter<void>();

  readonly store = inject(EconomyStore);
  mode: 'report' | 'block' = 'report';
  reportReason = 'harassment';
  reportDetails = '';

  async submitReport(): Promise<void> {
    await this.store.reportUser(this.targetId, this.reportReason, this.reportDetails);
    this.closed.emit();
  }

  async confirmBlock(): Promise<void> {
    await this.store.blockUser(this.targetId);
    this.closed.emit();
  }
}
