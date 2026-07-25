import { Component, EventEmitter, Input, Output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';

@Component({
  selector: 'app-correction-modal',
  imports: [CommonModule, FormsModule, TranslatePipe, VisualDiffComponent],
  templateUrl: './correction-modal.component.html',
  styleUrls: ['./correction-modal.component.scss'],
})
export class CorrectionModalComponent implements OnInit {
  @Input({ required: true }) originalText = '';
  @Input() authorName = '';

  @Output() submitted = new EventEmitter<{
    original: string;
    corrected: string;
    explanation?: string;
  }>();
  @Output() cancelled = new EventEmitter<void>();

  readonly correctedText = signal<string>('');
  readonly explanation = signal<string>('');

  ngOnInit(): void {
    this.correctedText.set(this.originalText);
  }

  onOriginalClick(): void {
    // Re-sync ghost text if user wants to reset
    this.correctedText.set(this.originalText);
  }

  submitCorrection(): void {
    const corr = this.correctedText().trim();
    if (!corr || corr === this.originalText.trim()) return;

    this.submitted.emit({
      original: this.originalText,
      corrected: corr,
      explanation: this.explanation().trim() || undefined,
    });
  }

  closeModal(): void {
    this.cancelled.emit();
  }
}
