import { Component, input, Output, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { SafetyService } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';
import type { ReportUserDto } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-user-modal.component.html',
  styleUrls: ['./report-user-modal.component.scss']
})
export class ReportUserModalComponent implements OnInit {
  private readonly safetyService = inject(SafetyService);
  private readonly toast = inject(ToastService);

  // Inputs / Outputs
  readonly reportedUserId = input.required<string>();
  readonly contextUrl    = input<string>('');
  readonly show          = input.required<boolean>();

  // expose a single close event (used by parent)
  readonly close         = output<void>();

  // UI state
  readonly selectedCategory = signal<string | null>(null);
  readonly description      = signal<string>('');
  readonly submitting       = signal(false);

  // Dynamic categories
  categories$: Observable<{ value: string; label: string }[]> = of([]);
  loadingCategories = signal(false);
  loadError         = signal(false);

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.loadingCategories.set(true);
    this.categories$ = this.safetyService.getCategories().pipe(
      tap(() => this.loadingCategories.set(false)),
      catchError(() => {
        this.loadError.set(true);
        this.loadingCategories.set(false);
        return of([]);
      })
    );
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
        description: this.description() || undefined,
        context_url: this.contextUrl() || undefined
      };
      await firstValueFrom(this.safetyService.reportUser(payload));
      this.toast.show('Report submitted successfully', { type: 'success' });
    } catch {
      this.toast.show('Failed to submit report', { type: 'error' });
    } finally {
      this.submitting.set(false);
      this.close.emit();
    }
  }
}
