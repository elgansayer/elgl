import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
  computed,
  inject,
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
  // Renamed to avoid 'closed' being treated as a native DOM event name
  @Output() modalClosed = new EventEmitter<void>();
  @Output() reported = new EventEmitter<void>();

  isOpen = signal(false);

  open(userId: string): void {
    this.reportUserId = userId;
    this.selectedCategory.set(null);
    this.description.set('');
    this.errorMessage.set(null);
    this.isOpen.set(true);
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

  private safetyService = inject(SafetyService);
  private toastService = inject(ToastService);

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
    this.isOpen.set(false);
    this.modalClosed.emit();
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

      this.isOpen.set(false);
      this.modalClosed.emit();
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(
        errorObj?.error?.message || 'Failed to submit report. Please try again.',
      );
      this.isSubmitting.set(false);
    }
  }
}
