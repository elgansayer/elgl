import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportCategory } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-user-modal.component.html',
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

  // Loading and error states for category fetch
  loadingCategories = signal<boolean>(true);
  loadError = signal<boolean>(false);
  blockUser = signal<boolean>(false);

  // Derived view of categories for the template
  categoriesToShow = computed(() => this.categories());

  ngOnInit(): void {
    this.loadingCategories.set(true);
    this.loadError.set(false);
    this.safetyService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loadingCategories.set(false);
      },
      error: () => {
        // Fallback to static list; service already handles this, but ensure we have something
        this.categories.set(this.safetyService.getStaticReportCategories());
        this.loadError.set(true);
        this.loadingCategories.set(false);
      },
    });
  }

  selectCategory(value: string): void {
    this.selectedCategory.set(value);
  }

  retryLoadCategories(): void {
    this.loadingCategories.set(true);
    this.loadError.set(false);
    this.safetyService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loadingCategories.set(false);
      },
      error: () => {
        this.categories.set(this.safetyService.getStaticReportCategories());
        this.loadError.set(true);
        this.loadingCategories.set(false);
      },
    });
  }

  cancel(): void {
    this.close.emit();
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

      // If the user also chose to block, perform the block
      if (this.blockUser()) {
        await this.safetyService.blockUserAsync(this.reportedUserId);
      }

      this.submitted.emit();
    } catch (err: any) {
      this.errorMessage.set(
        err?.message || 'Failed to submit report. Please try again.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
