import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { NgForOf, NgIf } from '@angular/common';
import { ReportService } from '../../../services/report.service';

export interface ReportDialogData {
  reportedUserId: string;
  reportedUserName?: string;
}

@Component({
  standalone: true,
  selector: 'app-report-user-modal',
  templateUrl: './report-user-modal.component.html',
  styleUrls: ['./report-user-modal.component.scss'],
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    NgIf,
    NgForOf
  ]
})
export class ReportUserModalComponent implements OnInit {
  reportForm!: FormGroup;

  reasonOptions = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'fake_profile', label: 'Fake Profile' },
    { value: 'other', label: 'Other' }
  ];

  constructor(
    public dialogRef: MatDialogRef<ReportUserModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportDialogData,
    private fb: FormBuilder,
    private reportService: ReportService
  ) {}

  ngOnInit(): void {
    this.reportForm = this.fb.group({
      reasonCategory: ['', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(500)]]
    });
  }

  submitReport(): void {
    if (this.reportForm.invalid) {
      return;
    }
    const payload = {
      reportedUserId: this.data.reportedUserId,
      reasonCategory: this.reportForm.value.reasonCategory,
      description: this.reportForm.value.description
    };
    this.reportService.createReport(payload).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Report failed', err);
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
