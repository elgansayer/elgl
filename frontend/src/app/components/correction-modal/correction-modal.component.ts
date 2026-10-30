import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTextarea } from '@spartan-ng/helm/textarea';

import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';

/** Translation keys for the quick tags a corrector can add to an explanation. */
const QUICK_TAG_KEYS: readonly string[] = [
  'correction.tag.naturalPhrasing',
  'correction.tag.grammar',
  'correction.tag.typo',
  'correction.tag.vocabulary',
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-correction-modal',
  imports: [
    HlmTextarea,
    HlmInput,
    HlmButton,
    ...HlmDialogImports,
    FormsModule,
    TranslatePipe,
    VisualDiffComponent,
  ],
  templateUrl: './correction-modal.component.html',
  styleUrls: ['./correction-modal.component.scss'],
})
export class CorrectionModalComponent implements OnInit {
  private readonly i18n = inject(I18nService);

  /**
   * Labels follow the interface language, so a tag is written in the corrector's own language.
   * The key identifies a tag even if two languages happen to translate two labels identically.
   */
  readonly quickTags = computed(() =>
    QUICK_TAG_KEYS.map((key) => ({ key, label: this.i18n.translate(key) })),
  );

  addQuickTag(tag: string): void {
    const current = this.explanation().trim();
    this.explanation.set(current ? `${current} [${tag}]` : `[${tag}]`);
  }
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
  readonly dialogState = signal<HlmDialogState>('open');

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
