import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SafetyService,
  ReportCategory,
  ReportUserDto,
} from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './report-user-modal.component.html',
})
export class ReportUserModalComponent implements OnInit {
  @Input({ required: false }) reportUserId: string = '';
  @Input() contextUrl?: string;
  @Output() close = new EventEmitter<void>();
  @Output() reported = new EventEmitter<void>();

  open(userId: string): void {
    this.reportUserId = userId;
    this.selectedCategory.set(null);
    this.description.set('');
    this.errorMessage.set(null);
  }

  // Loading / error states for categories
  loadingCategories = signal(false);
  loadError = signal(false);

  // Categories from backend / static fallback
  categories = signal<ReportCategory[]>([]);

  // Selected category value
  selectedCategory = signal<string | null>(null);

  // Additional form fields
  description = signal('');
  blockUser = signal(false);

  // Submission state
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  // Derived list of categories to show
  categoriesToShow = computed(() => this.categories());

  constructor(
    private safetyService: SafetyService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loadingCategories.set(true);
    this.loadError.set(false);

    this.safetyService.getReportCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loadingCategories.set(false);
      },
      error: () => {
        // Even though the service provides a fallback, we show an error UI
        this.loadError.set(true);
        this.loadingCategories.set(false);
      },
    });
  }

  retryLoadCategories(): void {
    this.loadCategories();
  }

  selectCategory(value: string): void {
    this.selectedCategory.set(value);
    this.errorMessage.set(null); // clear any submission error
  }

  cancel(): void {
    this.close.emit();
  }

  async submitReport(): Promise<void> {
    if (!this.selectedCategory() || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: ReportUserDto = {
      reported_id: this.reportUserId,
      reason_category: this.selectedCategory()!,
      description: this.description() || undefined,
      context_url: this.contextUrl,
    };

    try {
      await this.safetyService.reportUserAsync(dto);
      this.reported.emit();
      this.toastService.show('Report submitted successfully.', {
        type: 'success',
      });

      if (this.blockUser()) {
        // Fire‑and‑forget block – errors are logged but don’t block the report flow
        this.safetyService
          .blockUserAsync(this.reportUserId)
          .catch((err) =>
            console.error('Failed to block user after report:', err),
          );
      }

      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(
        err?.error?.message || 'Failed to submit report. Please try again.',
      );
      this.isSubmitting.set(false);
    }
  }
}
