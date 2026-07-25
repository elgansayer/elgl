import { Component, input, output, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';
import type { ReportUserDto } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-user-modal.component.html',
  styles: [`
    :host { display: block; }
    /* Ensure bottom sheet appears above all content on small screens */
    @media (max-width: 640px) {
      .mx-auto { margin-left: auto; margin-right: auto; }
    }
  `]
})
export class ReportUserModalComponent implements OnInit {
  private readonly safetyService = inject(SafetyService);
  private readonly toast = inject(ToastService);

  readonly reportedUserId = input.required<string>();
  readonly contextUrl    = input<string>('');
  readonly show          = input.required<boolean>();

  readonly close         = output<void>();
  readonly reported      = output<void>();

  readonly selectedCategory = signal<string | null>(null);
  readonly description      = signal<string>('');
  readonly submitting       = signal(false);
  readonly blockUser        = signal(false);

  categories = signal<ReportCategory[]>([]);
  loadingCategories = signal(false);
  loadError = signal(false);

  staticCategories = computed(() => this.safetyService.getStaticReportCategories());

  categoriesToShow = computed(() => {
    if (this.loadError() || this.categories().length === 0) {
      return this.staticCategories();
    }
    return this.categories();
  });

  ngOnInit(): void {
    this.resetForm();
    this.loadCategories();
  }

  private resetForm(): void {
    this.selectedCategory.set(null);
    this.description.set('');
    this.blockUser.set(false);
  }

  selectCategory(value: string): void {
    this.selectedCategory.set(value);
  }

  private async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    this.loadError.set(false);
    try {
      const cats = await lastValueFrom(
        this.safetyService.getCategories().pipe(
          catchError(() => of(this.safetyService.getStaticReportCategories()))
        )
      );
      this.categories.set(cats);
      if (cats.length === 0) {
        this.loadError.set(true);
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loadingCategories.set(false);
    }
  }

  retryLoadCategories(): void {
    this.loadCategories();
  }

  cancel(): void {
    this.close.emit();
  }

  async submitReport(): Promise<void> {
    if (!this.selectedCategory()) return;
    this.submitting.set(true);
    try {
      const payload: ReportUserDto = {
        reported_id: this.reportedUserId(),
        reason_category: this.selectedCategory()!,
        description: this.description().trim() || undefined,
        context_url: this.contextUrl() || undefined
      };
      const requests: Promise<any>[] = [lastValueFrom(this.safetyService.reportUser(payload))];

      if (this.blockUser()) {
        requests.push(lastValueFrom(this.safetyService.blockUser(this.reportedUserId())));
      }

      await Promise.all(requests);

      this.toast.show(
        this.blockUser()
          ? 'Report sent & user blocked'
          : 'Report sent! Thanks for the feedback',
        { type: 'success' }
      );
      this.reported.emit();
      this.close.emit();
    } catch {
      this.toast.show('Failed to submit report', { type: 'error' });
    } finally {
      this.submitting.set(false);
    }
  }
}
