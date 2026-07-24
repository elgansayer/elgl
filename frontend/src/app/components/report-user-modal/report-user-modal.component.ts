import { Component, inject, signal, output, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SafetyService, ReportUserDto } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';

export interface ReportCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" (click)="onBackdropClick($event)">
      <div class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 class="text-lg font-bold text-white">Report User</h2>
          <button (click)="close.emit()" class="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Category Selection -->
        <div class="p-4 space-y-3">
          <p class="text-sm text-gray-400 mb-2">Why are you reporting this user?</p>
          
          @for (category of categories; track category.id) {
            <button
              (click)="selectedCategory.set(category.id)"
              class="w-full text-left p-3 rounded-xl border transition-all duration-200"
              [class.border-purple-500]="selectedCategory() === category.id"
              [class.border-gray-700]="selectedCategory() !== category.id"
              [class.bg-purple-500/10]="selectedCategory() === category.id"
              [class.hover:bg-gray-800]="selectedCategory() !== category.id"
            >
              <div class="flex items-start gap-3">
                <span class="text-xl mt-0.5">{{ category.icon }}</span>
                <div>
                  <div class="font-medium text-white">{{ category.label }}</div>
                  <div class="text-sm text-gray-400 mt-0.5">{{ category.description }}</div>
                </div>
              </div>
            </button>
          }
        </div>

        <!-- Description (shown when category selected) -->
        @if (selectedCategory()) {
          <div class="px-4 pb-4">
            <label class="block text-sm text-gray-400 mb-1.5">Additional details (optional)</label>
            <textarea
              [(ngModel)]="description"
              rows="3"
              maxlength="500"
              placeholder="Provide any additional context..."
              class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
            ></textarea>
            <div class="text-right text-xs text-gray-500 mt-1">{{ description().length }}/500</div>
          </div>
        }

        <!-- Actions -->
        <div class="flex gap-3 p-4 border-t border-gray-700">
          <button
            (click)="close.emit()"
            class="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            (click)="submitReport()"
            [disabled]="!selectedCategory() || isSubmitting()"
            class="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200"
            [class.bg-red-600]="selectedCategory()"
            [class.hover:bg-red-700]="selectedCategory()"
            [class.text-white]="selectedCategory()"
            [class.bg-gray-700]="!selectedCategory()"
            [class.text-gray-500]="!selectedCategory()"
            [class.cursor-not-allowed]="!selectedCategory() || isSubmitting()"
          >
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
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class ReportUserModalComponent {
  private safetyService = inject(SafetyService);
  private toastService = inject(ToastService);

  readonly userId = input.required<string>();
  readonly close = output<void>();
  readonly reported = output<void>();

  readonly selectedCategory = signal<string>('');
  readonly description = signal<string>('');
  readonly isSubmitting = signal(false);

  readonly categories: ReportCategory[] = [
    {
      id: 'harassment',
      label: 'Harassment or Bullying',
      description: 'Unwanted advances, threats, or abusive behaviour',
      icon: '🚫'
    },
    {
      id: 'spam',
      label: 'Spam or Scam',
      description: 'Suspicious links, fake offers, or repetitive messages',
      icon: '📧'
    },
    {
      id: 'inappropriate_content',
      label: 'Inappropriate Content',
      description: 'Sexual, violent, or offensive material',
      icon: '⚠️'
    },
    {
      id: 'fake_profile',
      label: 'Fake Profile',
      description: 'Impersonation, fake identity, or catfishing',
      icon: '🎭'
    },
    {
      id: 'other',
      label: 'Other',
      description: 'Something else not listed above',
      icon: '📝'
    }
  ];

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close.emit();
    }
  }

  async submitReport(): Promise<void> {
    if (!this.selectedCategory() || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    try {
      const dto: ReportUserDto = {
        reported_id: this.userId(),
        reason_category: this.selectedCategory(),
        description: this.description() || undefined
      };

      await firstValueFrom(this.safetyService.reportUser(dto));
      this.toastService.show({
        message: 'Report submitted successfully. Our team will review it.',
        type: 'success',
        duration: 4000
      });
      this.reported.emit();
      this.close.emit();
    } catch (error) {
      this.toastService.show({
        message: 'Failed to submit report. Please try again.',
        type: 'error',
        duration: 4000
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
