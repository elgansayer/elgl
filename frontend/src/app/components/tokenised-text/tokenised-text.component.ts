import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocabularyStore } from '../../services/vocabulary.store';

export interface TokenSegment {
  segment: string;
  isWordLike: boolean;
  index: number;
}

@Component({
  selector: 'app-tokenised-text',
  imports: [CommonModule],
  templateUrl: './tokenised-text.component.html',
  styleUrls: ['./tokenised-text.component.scss']
})
export class TokenisedTextComponent implements OnInit {
  readonly vocabStore = inject(VocabularyStore);

  @Input({ required: true }) text = '';
  @Input() language = 'en';
  @Output() wordClicked = new EventEmitter<{ token: string; context: string }>();

  readonly tokens = signal<TokenSegment[]>([]);

  ngOnInit(): void {
    this.parseText();
  }

  private parseText(): void {
    const segments: TokenSegment[] = [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(this.language, { granularity: 'word' });
      const rawSegments = segmenter.segment(this.text);
      for (const item of rawSegments) {
        segments.push({
          segment: item.segment,
          isWordLike: item.isWordLike ?? /\w/.test(item.segment),
          index: item.index
        });
      }
    } else {
      // Emergency fallback if browser environment lacks Intl.Segmenter (though Rule 3 notes baseline 2024 support)
      const parts = this.text.split(/(\s+|[.,!?;:"'()]+)/);
      parts.forEach((part, idx) => {
        if (part) {
          segments.push({
            segment: part,
            isWordLike: /^\w+$/.test(part),
            index: idx
          });
        }
      });
    }
    this.tokens.set(segments);
  }

  onTokenClick(token: TokenSegment): void {
    if (!token.isWordLike) return;
    this.wordClicked.emit({
      token: token.segment,
      context: this.text
    });
  }
}
