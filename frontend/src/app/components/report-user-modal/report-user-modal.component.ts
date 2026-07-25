import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportCategory } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop overlay -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" (click)="close.emit()">
      <!-- Modal card -->
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-lg m-4 text-slate-100" (click)="$event.stopPropagation()">
        <h2 class="text-xl font-bold mb-4">Report User</h2>
        
        <p class="text-slate-400 mb-4">Please select a reason and provide any additional details.</p>

        <!-- Category selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Reason</label>
          <div class="space-y-2">
            @for (category of categories(); track category.value) {
              <label class="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                     [class.bg-indigo-600/20]="selectedCategory() === category.value"
                     [class.hover:bg-slate-700/50]="selectedCategory() !== category.value">
                <input type="radio"
                       name="report-category"
                       [value]="category.value" 
                       [ngModel]="selectedCategory()" 
                       (ngModelChange)="selectedCategory.set($event)" 
                       class="mt-0.5" />
                <div>
                  <span class="font-medium">{{ category.icon }} {{ category.label }}</span>
                  @if (category.description) {
                    <p class="text-xs text-slate-400 mt-1">{{ category.description }}</p>
                  }
                </div>
              </label>
            }
          </div>
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label for="report-description" class="block text-sm font-medium mb-2">Additional details (optional)</label>
          <textarea id="report-description"
                    [ngModel]="description()"
                    (ngModelChange)="description.set($event)"
                    rows="3"
                    maxlength="500"
                    placeholder="Please describe what happened..."
                    class="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"></textarea>
        </div>

        <!-- Error message -->
        @if (errorMessage()) {
          <div class="text-red-400 text-sm mb-4">{{ errorMessage() }}</div>
        }

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button type="button"
                  (click)="close.emit()"
                  class="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors"
                  [disabled]="isSubmitting()">
            Cancel
          </button>
          <button type="button"
                  (click)="submitReport()"
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  [disabled]="isSubmitting() || !selectedCategory()">
            {{ isSubmitting() ? 'Submitting...' : 'Submit Report' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReportUserModalComponent implements OnInit {
  private safetyService = inject(SafetyService);

  @Input({ required: true }) reportedUserId!: string;
  @Input() contextUrl?: string;

  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  categories = signal<ReportCategory[]>([]);
  selectedCategory = signal<string>('');
  description = signal<string>('');
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string>('');

  ngOnInit(): void {
    this.safetyService.getReportCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {
        // Fallback to static list if API fails (service already handles this)
        this.categories.set(this.safetyService.getStaticReportCategories());
      }
    });
  }

  async submitReport(): Promise<void> {
    const category = this.selectedCategory();
    if (!category) {
      this.errorMessage.set('Please select a reason.');
      return;
    }

    this.errorMessage.set('');
    this.isSubmitting.set(true);

    try {
      await this.safetyService.reportUserAsync({
        reported_id: this.reportedUserId,
        reason_category: category,
        description: this.description() || undefined,
        context_url: this.contextUrl || undefined,
      });
      this.submitted.emit();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to submit report. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
