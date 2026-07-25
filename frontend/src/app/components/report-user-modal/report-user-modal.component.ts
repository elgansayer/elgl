import { Component, Input, Output, EventEmitter, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent],
  template: `
    @if (show) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
           (click)="close()">
        <app-card variant="elevated" customClass="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
                  (click)="$event.stopPropagation()">
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-bold text-white">Report User</h2>
              <button (click)="close()"
                      class="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700/50">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Step 1: Category Selection -->
            @if (step() === 'category') {
              <div>
                <p class="text-slate-300 mb-4">Why are you reporting this user?</p>
                <div class="space-y-3">
                  @for (category of categories(); track category.value) {
                    <button (click)="selectCategory(category)"
                            class="w-full text-start p-4 rounded-xl border border-slate-700/50
                                   hover:border-red-500/50 hover:bg-red-500/5
                                   transition-all duration-200 group">
                      <div class="flex items-start gap-3">
                        <span class="text-2xl">{{ categoryIcons[category.value] || '📝' }}</span>
                        <div>
                          <div class="font-semibold text-white group-hover:text-red-300 transition-colors">
                            {{ category.label }}
                          </div>
                          <div class="text-sm text-slate-400 mt-1">{{ categoryDescriptions[category.value] }}</div>
                        </div>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Step 2: Details & Submit -->
            @if (step() === 'details') {
              <div>
                <div class="flex items-center gap-2 mb-4">
                  <button (click)="step.set('category')"
                          class="text-slate-400 hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                  </button>
                  <span class="text-sm text-slate-400">Back to categories</span>
                </div>

                <div class="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div class="flex items-center gap-2">
                    <span>{{ categoryIcons[selectedCategory()?.value || ''] }}</span>
                    <span class="font-medium text-white">{{ selectedCategory()?.label }}</span>
                  </div>
                </div>

                <div class="mb-4">
                  <label class="block text-sm font-medium text-slate-300 mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    [(ngModel)]="description"
                    rows="4"
                    maxlength="1000"
                    placeholder="Provide any additional context..."
                    class="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                           text-white placeholder-slate-500 focus:outline-none focus:ring-2
                           focus:ring-red-500/50 focus:border-red-500/50 resize-none transition-all"
                  ></textarea>
                  <div class="text-end text-xs text-slate-500 mt-1">
                    {{ description().length }}/1000
                  </div>
                </div>

                <!-- Context URL (optional) -->
                <div class="mb-4">
                  <label class="block text-sm font-medium text-slate-300 mb-2">
                    Link to message / moment (optional)
                  </label>
                  <input
                    type="url"
                    [(ngModel)]="contextUrl"
                    placeholder="Paste a direct link..."
                    class="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                           text-white placeholder-slate-500 focus:outline-none focus:ring-2
                           focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                  />
                </div>

                @if (error()) {
                  <div class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    {{ error() }}
                  </div>
                }

                <div class="flex gap-3">
                  <button (click)="close()"
                          class="flex-1 px-4 py-2.5 rounded-lg border border-slate-700/50
                                 text-slate-300 hover:bg-slate-700/50 transition-all font-medium">
                    Cancel
                  </button>
                  <button (click)="submitReport()"
                          [disabled]="isSubmitting()"
                          class="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-white font-semibold transition-all">
                    @if (isSubmitting()) {
                      <span class="flex items-center justify-center gap-2">
                        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Submitting...
                      </span>
                    } @else {
                      Submit Report
                    }
                  </button>
                </div>
              </div>
            }

            <!-- Step 3: Success -->
            @if (step() === 'success') {
              <div class="text-center py-8">
                <div class="text-5xl mb-4">✅</div>
                <h3 class="text-xl font-bold text-white mb-2">Report Submitted</h3>
                <p class="text-slate-300 mb-6">
                  Thank you for helping keep our community safe. Our moderation team will review this report.
                </p>
                <button (click)="close()"
                        class="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-all">
                  Done
                </button>
              </div>
            }
          </div>
        </app-card>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class ReportUserModalComponent implements OnInit {
  @Input() reportUserId!: string;
  @Input() show = false;
  @Output() closed = new EventEmitter<void>();

  private readonly safetyService = inject(SafetyService);
  private readonly toastService = inject(ToastService);

  readonly step = signal<'category' | 'details' | 'success'>('category');
  readonly categories = signal<ReportCategory[]>([]);
  readonly selectedCategory = signal<ReportCategory | null>(null);
  readonly description = signal('');
  readonly contextUrl = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly categoryIcons: Record<string, string> = {
    harassment: '🚫',
    spam: '📧',
    inappropriate_content: '🔞',
    fake_profile: '🎭',
    other: '📝'
  };

  readonly categoryDescriptions: Record<string, string> = {
    harassment: 'Unwanted advances, threats, or abusive behaviour',
    spam: 'Unsolicited promotions, phishing, or fraudulent activity',
    inappropriate_content: 'Sexually explicit, violent, or offensive material',
    fake_profile: 'Pretending to be someone else or using false identity',
    other: 'Something else not listed above'
  };

  ngOnInit(): void {
    // Fetch categories once and store them
    this.categories.set(this.safetyService.getReportCategories());
  }

  close(): void {
    this.show = false;
    this.closed.emit();
  }

  selectCategory(category: ReportCategory): void {
    this.selectedCategory.set(category);
    this.step.set('details');
    this.error.set(null);
  }

  async submitReport(): Promise<void> {
    if (!this.reportUserId || !this.selectedCategory()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      await this.safetyService.reportUserAsync({
        reported_id: this.reportUserId,
        reason_category: this.selectedCategory()!.value,
        description: this.description() || undefined,
        context_url: this.contextUrl() || undefined  // include context URL
      });

      this.step.set('success');
      this.toastService.show('Report submitted successfully', {
        type: 'success',
        duration: 3000
      });
    } catch (err) {
      this.error.set('Failed to submit report. Please try again.');
      this.toastService.show('Failed to submit report', {
        type: 'error',
        duration: 5000
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
