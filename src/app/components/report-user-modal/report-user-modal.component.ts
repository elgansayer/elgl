import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface ReportUserDto {
  reported_id: string;
  reason_category: string;
  description?: string;
  context_url?: string;
}

const REPORT_CATEGORIES: Record<string, string[]> = {
  harassment: ['Verbal abuse', 'Threats', 'Bullying'],
  spam: ['Unsolicited advertising', 'Repeated messages'],
  inappropriate_content: ['Nudity', 'Violence', 'Hate speech'],
  impersonation: ['Pretending to be me', 'Fake celebrity'],
  underage: ['User is under 13', 'Suspicious minor'],
  other: []
};

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './report-user-modal.component.html',
  // styleUrl: './report-user-modal.component.css'
})
export class ReportUserModalComponent implements OnInit {
  @Input() reportUserId!: string;
  @Input() contextUrl?: string;
  @Output() reportSubmitted = new EventEmitter<ReportUserDto & { block_user?: boolean }>();

  reportForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.reportForm = this.fb.group({
      mainCategory: ['', Validators.required],
      subCategory: [{ value: '', disabled: true }],
      description: ['', [Validators.maxLength(500)]],
      block_user: [false]
    });

    this.reportForm.get('mainCategory')?.valueChanges.subscribe(main => {
      const subControl = this.reportForm.get('subCategory');
      if (main && REPORT_CATEGORIES[main]?.length) {
        subControl?.enable();
        subControl?.setValidators(Validators.required);
      } else {
        subControl?.disable();
        subControl?.clearValidators();
        subControl?.setValue('');
      }
      subControl?.updateValueAndValidity();
    });
  }

  getSubCategories(main: string): string[] {
    return REPORT_CATEGORIES[main] ?? [];
  }

  submitReport(): void {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    const formValue = this.reportForm.value;
    const reason = formValue.subCategory
      ? `${formValue.mainCategory}:${formValue.subCategory}`
      : formValue.mainCategory;

    const dto: ReportUserDto & { block_user?: boolean } = {
      reported_id: this.reportUserId,
      reason_category: reason,
      description: formValue.description || undefined,
      context_url: this.contextUrl,
      block_user: formValue.block_user || false
    };

    this.reportSubmitted.emit(dto);
  }
}
