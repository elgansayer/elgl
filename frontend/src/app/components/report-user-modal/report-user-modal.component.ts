import {
  Component,
  computed,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SafetyService, ReportUserDto } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      (click)="close.emit()"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-xl font-bold text-white mb-4">Report User</h2>

        <!-- Error message -->
        @if (errorMessage) {
          <div class="bg-red-500/20 text-red-300 px-4 py-2 rounded-lg mb-4">
            {{ errorMessage }}
          </div>
        }

        <form [formGroup]="reportForm" (ngSubmit)="submitReport()" class="space-y-4">
          <!-- Main Reason -->
          <div>
            <label class="block text-sm text-slate-400 mb-1"
              >Reason <span class="text-red-400">*</span></label
            >
            <select
              formControlName="mainCategory"
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="" disabled>Select a reason…</option>
              @for (cat of mainCategories; track cat) {
                <option [value]="cat">{{ cat }}</option>
              }
            </select>
          </div>

          <!-- Sub‑category (shown only if main category has sub options) -->
          @if (subCategories().length) {
            <div>
              <label class="block text-sm text-slate-400 mb-1"
                >Specific issue</label
              >
              <select
                formControlName="subCategory"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">None</option>
                @for (sub of subCategories(); track sub) {
                  <option [value]="sub">{{ sub }}</option>
                }
              </select>
            </div>
          }

          <!-- Description -->
          <div>
            <label class="block text-sm text-slate-400 mb-1"
              >Description (optional)</label
            >
            <textarea
              formControlName="description"
              placeholder="Provide more details…"
              rows="3"
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            ></textarea>
          </div>

          <!-- Block toggle -->
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="blockUser"
              formControlName="blockUser"
              class="form-checkbox h-4 w-4 rounded text-indigo-500 bg-slate-800 border-slate-600 focus:ring-indigo-500"
            />
            <label for="blockUser" class="text-sm text-slate-300"
              >Block this user immediately</label
            >
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              (click)="close.emit()"
              class="px-5 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="isSubmitting || reportForm.invalid"
              class="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              <span class="inline-flex items-center gap-2">
                @if (isSubmitting) {
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                }
                Submit Report
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class ReportUserModalComponent implements OnInit {
  @Input() reportUserId!: string;
  @Input() contextUrl?: string;
  @Output() close = new EventEmitter<void>();
  @Output() reported = new EventEmitter<void>();

  reportForm!: FormGroup;
  isSubmitting = false;
  errorMessage: string | null = null;

  private readonly REPORT_CATEGORIES: Record<string, string[]> = {
    'Harassment': ['Bullying', 'Threats', 'Sexual harassment'],
    'Spam': ['Fake account / Bot', 'Unwanted promotion'],
    'Inappropriate content': ['Nudity', 'Violence', 'Hate speech'],
    'Other': [],
  };

  mainCategories = Object.keys(this.REPORT_CATEGORIES);

  private readonly _mainCategorySignal = signal<string>('');

  subCategories = computed(() => {
    const main = this._mainCategorySignal();
    return main ? this.REPORT_CATEGORIES[main] ?? [] : [];
  });

  constructor(
    private fb: FormBuilder,
    private safetyService: SafetyService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.reportForm = this.fb.group({
      mainCategory: ['', Validators.required],
      subCategory: [''],
      description: [''],
      blockUser: [false],
    });

    this.reportForm
      .get('mainCategory')!
      .valueChanges.subscribe((val: string) =>
        this._mainCategorySignal.set(val ?? ''),
      );
  }

  submitReport() {
    if (this.reportForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const { mainCategory, subCategory, description, blockUser } =
      this.reportForm.value;
    const reason = subCategory
      ? `${mainCategory}:${subCategory}`
      : mainCategory;

    const dto: ReportUserDto & { block_user?: boolean } = {
      reported_id: this.reportUserId,
      reason_category: reason,
      description: description || undefined,
      context_url: this.contextUrl,
      block_user: blockUser,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.toastService.show('Report submitted successfully.', { type: 'success' });
        this.reported.emit();
        this.close.emit();
      },
      error: (err) => {
        this.errorMessage =
          err?.error?.message || 'Failed to submit report. Please try again.';
        this.isSubmitting = false;
      },
    });
  }
}
