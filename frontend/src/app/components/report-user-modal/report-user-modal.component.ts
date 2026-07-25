import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { I18nService } from '../../services/i18n.service';
import { Subscription } from 'rxjs';

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
              <h2 class="text-xl font-bold text-white">{{ translatedLabel('title') }}</h2>
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
                <p class="text-slate-300 mb-4">{{ translatedLabel('reportReason') }}</p>

                @if (loadingCategories()) {
                  <div class="flex justify-center py-8">
                    <svg class="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span class="ms-2 text-slate-400">{{ translatedLabel('loadingCategories') }}</span>
                  </div>
                } @else {
                  @if (loadCategoriesError()) {
                    <div class="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
                      {{ loadCategoriesError() }}
                    </div>
                  }

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
                              {{ translatedLabel(category.value) }}
                            </div>
                            <div class="text-sm text-slate-400 mt-1">{{ translatedDescription(category.value) }}</div>
                          </div>
                        </div>
                      </button>
                    }
                  </div>
                }
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
                  <span class="text-sm text-slate-400">{{ translatedLabel('backToCategories') }}</span>
                </div>

                <div class="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div class="flex items-center gap-2">
                    <span>{{ categoryIcons[selectedCategory()?.value || ''] }}</span>
                    <span class="font-medium text-white">{{ translatedLabel(selectedCategory()?.value || '') }}</span>
                  </div>
                </div>

                <div class="mb-4">
                  <label class="block text-sm font-medium text-slate-300 mb-2">
                    {{ translatedLabel('additionalDetails') }}
                  </label>
                  <textarea
                    [ngModel]="description()"
                    (ngModelChange)="description.set($event)"
                    rows="4"
                    maxlength="1000"
                    [placeholder]="translatedLabel('additionalDetailsPlaceholder')"
                    class="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                           text-white placeholder-slate-500 focus:outline-none focus:ring-2
                           focus:ring-red-500/50 focus:border-red-500/50 resize-none transition-all"
                  ></textarea>
                  <div class="text-end text-xs text-slate-500 mt-1">
                    {{ description().length }} / 1000
                  </div>
                </div>

                <!-- Context URL (optional) -->
                <div class="mb-4">
                  <label class="block text-sm font-medium text-slate-300 mb-2">
                    {{ translatedLabel('linkToContent') }}
                  </label>
                  <input
                    type="url"
                    [ngModel]="contextUrl()"
                    (ngModelChange)="contextUrl.set($event)"
                    [placeholder]="translatedLabel('linkToContentPlaceholder')"
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
                    {{ translatedLabel('cancel') }}
                  </button>
                  <button (click)="handleSubmit()"
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
                        {{ translatedLabel('submitting') }}
                      </span>
                    } @else {
                      {{ translatedLabel('submitReport') }}
                    }
                  </button>
                </div>
              </div>
            }

            <!-- Step 3: Success -->
            @if (step() === 'success') {
              <div class="text-center py-8">
                <div class="text-5xl mb-4">✅</div>
                <h3 class="text-xl font-bold text-white mb-2">{{ translatedLabel('reportSubmitted') }}</h3>
                <p class="text-slate-300 mb-6">
                  {{ translatedLabel('reportSubmittedMessage') }}
                </p>
                <button (click)="close()"
                        class="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-all">
                  {{ translatedLabel('done') }}
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
export class ReportUserModalComponent implements OnInit, OnDestroy {
  @Input() reportUserId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  private _show = false;

  @Input()
  set show(value: boolean) {
    this._show = value;
    if (value) {
      this.step.set('category');
      this.selectedCategory.set(null);
      this.description.set('');
      this.contextUrl.set('');
      this.error.set(null);
      this.loadCategories();   // optionally refresh categories every time it opens
    }
  }

  get show(): boolean {
    return this._show;
  }

  private readonly safetyService = inject(SafetyService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  readonly step = signal<'category' | 'details' | 'success'>('category');
  readonly categories = signal<ReportCategory[]>([]);
  readonly selectedCategory = signal<ReportCategory | null>(null);
  readonly description = signal('');
  readonly contextUrl = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly loadingCategories = signal(false);
  readonly loadCategoriesError = signal('');

  private categorySubscription?: Subscription;

  readonly categoryIcons: Record<string, string> = {
    harassment: '🚫',
    spam: '📧',
    inappropriate_content: '🔞',
    fake_profile: '🎭',
    other: '📝'
  };

  private readonly categoryLabelMap = new Map<string, string>();
  private readonly categoryDescriptionMap = new Map<string, string>();

  // ------------------------------------------------------------------
  // Translation helpers
  // ------------------------------------------------------------------
  translatedLabel(key: string): string {
    // Try a dedicated i18n key first; fall back to the original English label stored in the map
    const i18nKey = `report.category.${key}`;
    const translated = this.i18nService.translate(i18nKey, { defaultValue: '' });
    if (translated) {
      return translated;
    }
    // Fall back to the un‑translated label we remembered when categories were loaded
    const original = this.categoryLabelMap.get(key);
    if (original) {
      return original;
    }
    // Generic fallback for static strings like "title", "cancel", etc.
    return this.i18nService.translate(`report.${key}`, { defaultValue: key });
  }

  translatedDescription(key: string): string {
    const i18nKey = `report.category_description.${key}`;
    const translated = this.i18nService.translate(i18nKey, { defaultValue: '' });
    if (translated) {
      return translated;
    }
    return this.categoryDescriptionMap.get(key) ?? '';
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
  ngOnInit(): void {
    // Modal state reset and category loading are handled by the show setter.
  }

  ngOnDestroy(): void {
    this.categorySubscription?.unsubscribe();
  }

  private loadCategories(): void {
    this.loadingCategories.set(true);
    this.loadCategoriesError.set('');

    // Unsubscribe from any previous request to avoid memory leaks
    this.categorySubscription?.unsubscribe();

    this.categorySubscription = this.safetyService.getReportCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.populateMapsFromCategories(cats);
        this.loadingCategories.set(false);
      },
      error: (err) => {
        console.error('Failed to load report categories', err);
        const fallback = this.safetyService.getStaticReportCategories();
        this.categories.set(fallback);
        this.populateMapsFromCategories(fallback);
        this.loadingCategories.set(false);
        this.loadCategoriesError.set(
          this.i18nService.translate('report.error.load_categories', {
            defaultValue: 'Could not load categories. Using default list.',
          })
        );
      },
    });
  }

  private populateMapsFromCategories(cats: ReportCategory[]): void {
    this.categoryLabelMap.clear();
    this.categoryDescriptionMap.clear();

    for (const cat of cats) {
      this.categoryLabelMap.set(cat.value, cat.label);
      if (cat.icon) {
        this.categoryIcons[cat.value] = cat.icon;
      }
      if (cat.description) {
        this.categoryDescriptionMap.set(cat.value, cat.description);
      }
    }
  }

  // ------------------------------------------------------------------
  // Modal actions
  // ------------------------------------------------------------------
  close(): void {
    this.show = false;
    this.closed.emit();
  }

  selectCategory(category: ReportCategory): void {
    this.selectedCategory.set(category);
    this.step.set('details');
    this.error.set(null);
  }

  handleSubmit(): void {
    void this.submitReport();
  }

  private async submitReport(): Promise<void> {
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
        context_url: this.contextUrl() || undefined
      });

      this.step.set('success');
      this.submitted.emit();

      this.toastService.show(
        this.i18nService.translate('report.toast.success', { defaultValue: 'Report submitted successfully' }),
        { type: 'success', duration: 3000 }
      );
    } catch {
      this.error.set(
        this.i18nService.translate('report.error.submit_failed', { defaultValue: 'Failed to submit report. Please try again.' })
      );
      this.toastService.show(
        this.i18nService.translate('report.toast.error', { defaultValue: 'Failed to submit report' }),
        { type: 'error', duration: 5000 }
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
