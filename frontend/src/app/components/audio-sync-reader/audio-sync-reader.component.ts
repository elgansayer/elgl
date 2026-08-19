import { HlmButton } from '@spartan-ng/helm/button';
import { showToast } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';

import { VocabularyStore } from '../../services/vocabulary.store';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';

export interface TokenSegmentSpan {
  segment: string;
  isWordLike: boolean;
  index: number;
  charStart: number;
  charEnd: number;
}

@Component({
  selector: 'app-audio-sync-reader',
  imports: [
    HlmButton,
    TranslatePipe,
    WordDefinitionModalComponent,
    AppCardComponent,
    AppChipComponent,
  ],
  templateUrl: './audio-sync-reader.component.html',
  styleUrls: ['./audio-sync-reader.component.scss'],
})
export class AudioSyncReaderComponent implements OnDestroy {
  readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);

  readonly text = input.required<string>();
  readonly language = input<string>('en-GB');
  readonly audioUrl = input<string | undefined>();
  readonly title = input<string>('audioSync.immersionLessonTitle');
  readonly isVip = input<boolean>(false);

  readonly wordClicked = output<{ token: string; context: string }>();

  readonly tokens = signal<TokenSegmentSpan[]>([]);
  readonly activeTokenIndex = signal<number>(-1);
  readonly isPlaying = signal<boolean>(false);
  readonly selectedToken = signal<{ token: string; context: string } | null>(null);

  readonly activeToken = computed<TokenSegmentSpan | null>(() => {
    const idx = this.activeTokenIndex();
    const allTokens = this.tokens();
    if (idx < 0 || idx >= allTokens.length) return null;
    return allTokens[idx];
  });

  readonly wordLikeTokenCount = computed<number>(() => {
    return this.tokens().filter((t) => t.isWordLike).length;
  });

  private audioElement: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    effect(() => {
      const rawText = this.text();
      const lang = this.language();
      this.parseTokens(rawText, lang);
    });
  }

  private parseTokens(rawText: string, lang: string): void {
    const segments: TokenSegmentSpan[] = [];
    if (!rawText) {
      this.tokens.set([]);
      return;
    }

    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
      const rawSegments = segmenter.segment(rawText);
      let idx = 0;
      for (const item of rawSegments) {
        segments.push({
          segment: item.segment,
          isWordLike: item.isWordLike ?? /\w/.test(item.segment),
          index: idx++,
          charStart: item.index,
          charEnd: item.index + item.segment.length,
        });
      }
    } else {
      const parts = rawText.split(/(\s+|[.,!?;:"'()]+)/);
      let currentOffset = 0;
      parts.forEach((part, idx) => {
        if (part) {
          const charStart = currentOffset;
          const charEnd = currentOffset + part.length;
          currentOffset = charEnd;
          segments.push({
            segment: part,
            isWordLike: /^\w+$/.test(part),
            index: idx,
            charStart,
            charEnd,
          });
        }
      });
    }
    this.tokens.set(segments);
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.stopPlayback();
      return;
    }

    const url = this.audioUrl();
    if (url) {
      this.playHtml5Audio(url);
    } else {
      this.playSpeechSynthesis();
    }
  }

  private playHtml5Audio(url: string): void {
    this.stopPlayback();
    this.audioElement = new Audio(url);
    this.isPlaying.set(true);

    const wordLikeTokens = this.tokens().filter((t) => t.isWordLike);
    const totalWordCount = wordLikeTokens.length;

    this.audioElement.ontimeupdate = () => {
      if (
        !this.audioElement ||
        !this.isPlaying() ||
        totalWordCount === 0 ||
        !this.audioElement.duration
      )
        return;
      const progress = this.audioElement.currentTime / this.audioElement.duration;
      const targetIndex = Math.min(Math.floor(progress * totalWordCount), totalWordCount - 1);
      const activeSpan = wordLikeTokens[targetIndex];
      if (activeSpan) {
        this.activeTokenIndex.set(activeSpan.index);
      }
    };

    this.audioElement.onended = () => {
      this.stopPlayback();
    };

    this.audioElement.onerror = () => {
      this.stopPlayback();
    };

    this.audioElement.play().catch(() => {
      this.stopPlayback();
    });
  }

  private playSpeechSynthesis(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast(this.i18n.translate('audioSync.speechSynthesisUnavailable'));
      return;
    }

    this.stopPlayback();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(this.text());
    utterance.lang = this.language();
    utterance.rate = 0.85; // Slower cadence for immersion learners
    this.currentUtterance = utterance;

    utterance.onstart = () => {
      this.isPlaying.set(true);
      this.activeTokenIndex.set(0);
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        const matchingToken = this.tokens().find(
          (t) => charIndex >= t.charStart && charIndex < t.charEnd,
        );
        if (matchingToken) {
          this.activeTokenIndex.set(matchingToken.index);
        }
      }
    };

    utterance.onend = () => {
      this.stopPlayback();
    };

    utterance.onerror = () => {
      this.stopPlayback();
    };

    window.speechSynthesis.speak(utterance);
  }

  stopPlayback(): void {
    this.isPlaying.set(false);
    this.activeTokenIndex.set(-1);

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.ontimeupdate = null;
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.src = '';
      this.audioElement.load();
      this.audioElement = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  isTokenActive(token: TokenSegmentSpan): boolean {
    return token.index === this.activeTokenIndex();
  }

  getWordClass(token: TokenSegmentSpan): string {
    if (!token.isWordLike) {
      return 'text-text-secondary font-normal px-0.5';
    }
    const status = this.vocabStore.getWordStatus(token.segment);
    return `rounded px-1 py-0.5 transition-all duration-150 ${status.colourClass}`;
  }

  onTokenClick(token: TokenSegmentSpan): void {
    if (!token.isWordLike) return;
    this.selectedToken.set({
      token: token.segment,
      context: this.text(),
    });
    this.wordClicked.emit({
      token: token.segment,
      context: this.text(),
    });
  }

  /** IMPERATIVE CLEANUP EXCEPTION: Audio element + SpeechSynthesis require imperative teardown. */
  ngOnDestroy(): void {
    this.stopPlayback();
  }
}
