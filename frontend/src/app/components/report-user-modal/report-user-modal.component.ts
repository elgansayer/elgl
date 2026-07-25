import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportUserDto, ReportCategory } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent],
  template: `
    @if (show) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        (click)="close()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <app-card
          variant="elevated"
          customClass="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <h2 id="report-modal-title" class="text-xl font-bold text-white">
                Report User
              </h2>
              <button
                (click)="close()"
                class="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700/50"
                aria-label="Close"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Subtitle -->
            <p class="text-sm text-slate-300 mb-6 text-start">
              Hey there! Your report is totally anonymous – the other person won't know who reported them.
            </p>

            <!-- Dynamic category list -->
            @if (loadingCategories()) {
              <div class="flex justify-center py-8">
                <svg class="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span class="ms-2 text-slate-400">Loading reasons...</span>
              </div>
            } @else {
              @if (loadCategoriesError()) {
                <div class="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm text-start">
                  {{ loadCategoriesError() }}
                </div>
              }
              <div class="space-y-3 mb-6">
                @for (option of categories(); track option.value) {
                  <button
                    type="button"
                    class="w-full text-start p-4 rounded-xl border transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    [class.border-purple-500]="selectedReason() === option.value"
                    [class.bg-purple-500/10]="selectedReason() === option.value"
                    [class.border-slate-700/50]="selectedReason() !== option.value"
                    [class.hover:border-purple-500/50]="selectedReason() !== option.value"
                    [class.hover:bg-purple-500/5]="selectedReason() !== option.value"
                    (click)="selectReason(option.value)"
                  >
                    <div class="flex items-start gap-3">
                      <span class="text-2xl" aria-hidden="true">{{ option.icon || '📝' }}</span>
                      <div>
                        <div class="font-semibold text-white group-hover:text-purple-300 transition-colors text-start">
                          {{ option.label }}
                        </div>
                        @if (option.description) {
                          <div class="text-sm text-slate-400 mt-1 text-start">{{ option.description }}</div>
                        }
                      </div>
                    </div>
                  </button>
                }
              </div>
            }

            <!-- Description textarea -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2 text-start">
                Additional details <span class="text-slate-500">(optional)</span>
              </label>
              <textarea
                [ngModel]="description()"
                (ngModelChange)="description.set($event)"
                rows="3"
                maxlength="1000"
                placeholder="What happened? Any helpful context..."
                class="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                       text-white placeholder-slate-500 focus:outline-none focus:ring-2
                       focus:ring-red-500/50 focus:border-red-500/50 resize-none transition-all text-start"
              ></textarea>
              <div class="text-end text-xs text-slate-500 mt-1">
                {{ description().length }} / 1000
              </div>
            </div>

            <!-- Error message -->
            @if (error()) {
              <div class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-start">
                {{ error() }}
              </div>
            }

            <!-- Action buttons -->
            <div class="flex justify-end gap-3">
              <button
                type="button"
                class="px-5 py-2.5 text-sm font-medium text-slate-300 border border-slate-700/50 rounded-lg
                       hover:bg-slate-700/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                (click)="close()"
                [disabled]="isSubmitting()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg
                       hover:bg-red-700 transition-colors flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                (click)="handleSubmit()"
                [disabled]="isSubmitting() || !selectedReason()"
              >
                @if (isSubmitting()) {
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Submitting...
                } @else {
                  Submit Report
                }
              </button>
            </div>
          </div>
        </app-card>
      </div>
    }
  `,
  styles: [],
})
export class ReportUserModalComponent implements OnInit, OnDestroy {
  @Input() reportUserId!: string;

  // Input to control visibility from parent
  @Input() set show(value: boolean) {
    this._show.set(value);
    if (value) {
      // Reset state when opened
      this.selectedReason.set(null);
      this.description.set('');
      this.error.set(null);
    }
  }
  get show(): boolean {
    return this._show();
  }

  // External context URL (e.g., from the message)
  @Input() contextUrl?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<{
    reasonCategory: string;
    description: string;
  }>();

  private readonly safetyService = inject(SafetyService);
  private readonly toastService = inject(ToastService);

  private readonly _show = signal(false);

  readonly loadingCategories = signal(true);
  readonly loadCategoriesError = signal('');
  readonly categories = signal<ReportCategory[]>([]);
  readonly selectedReason = signal<string | null>(null);
  readonly description = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  private categorySub?: Subscription;

  // Keyboard accessibility: close modal on Esc
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event) {
    if (this.show) {
      event.preventDefault();
      this.close();
    }
  }

  // Static fallback list (kept here for clarity)
  private staticFallbackCategories(): ReportCategory[] {
    return [
      { value: 'harassment', label: 'Harassment', icon: '🚫', description: 'Bullying, insults, or threats.' },
      { value: 'spam', label: 'Spam', icon: '📧', description: 'Unsolicited promotions or repeated messages.' },
      { value: 'inappropriate_content', label: 'Inappropriate Content', icon: '🔞', description: 'Explicit, violent, or illegal material.' },
      { value: 'fake_profile', label: 'Fake Profile', icon: '🎭', description: 'Impersonation or false identity.' },
      { value: 'other', label: 'Other', icon: '📝', description: 'Something else – please provide details.' },
    ];
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.categorySub?.unsubscribe();
  }

  private loadCategories(): void {
    this.loadingCategories.set(true);
    this.loadCategoriesError.set('');
    this.categorySub?.unsubscribe();

    this.categorySub = this.safetyService.getReportCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loadingCategories.set(false);
      },
      error: (err) => {
        console.error('Failed to load report categories', err);
        // Use the fallback static list if API fails
        this.categories.set(this.staticFallbackCategories());
        this.loadCategoriesError.set(
          'Could not load categories. Using default list.'
        );
        this.loadingCategories.set(false);
      },
    });
  }

  selectReason(value: string): void {
    this.selectedReason.set(value);
  }

  close(): void {
    this.show = false;
    this.closed.emit();
  }

  handleSubmit(): void {
    void this.submitReport();
  }

  private async submitReport(): Promise<void> {
    const userId = this.reportUserId;
    const reason = this.selectedReason();
    if (!userId || !reason) return;

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      await this.safetyService.reportUserAsync({
        reported_id: userId,
        reason_category: reason,
        description: this.description() || undefined,
        context_url: this.contextUrl || undefined,
      });

      this.submitted.emit({
        reasonCategory: reason,
        description: this.description(),
      });

      this.toastService.show('Thanks for your report! We’re on it.', {
        type: 'success',
        duration: 3000,
      });
      this.close();
    } catch {
      this.error.set('Failed to submit report. Please try again.');
      this.toastService.show('Failed to submit report', {
        type: 'error',
        duration: 5000,
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
