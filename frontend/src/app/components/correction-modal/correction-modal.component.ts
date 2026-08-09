import { Component, input, output, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';

@Component({
  selector: 'app-correction-modal',
  imports: [FormsModule, TranslatePipe, VisualDiffComponent],
  templateUrl: './correction-modal.component.html',
  styleUrls: ['./correction-modal.component.scss'],
})
export class CorrectionModalComponent implements OnInit {
  originalText = input.required<string>();
  authorName = input('');

  submitted = output<{
    original: string;
    corrected: string;
    explanation?: string;
  }>();
  cancelled = output<void>();

  readonly correctedText = signal<string>('');
  readonly explanation = signal<string>('');

  ngOnInit(): void {
    this.correctedText.set(this.originalText());
  }

  onOriginalClick(): void {
    // Re-sync ghost text if user wants to reset
    this.correctedText.set(this.originalText());
  }

  submitCorrection(): void {
    const corr = this.correctedText().trim();
    if (!corr || corr === this.originalText().trim()) return;

    this.submitted.emit({
      original: this.originalText(),
      corrected: corr,
      explanation: this.explanation().trim() || undefined,
    });
  }

  closeModal(): void {
    this.cancelled.emit();
  }
}
