import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

export interface LanguagePartyCreatePayload {
  title: string;
  languagePair: string;
  topicTag: string;
  level: string;
  isVideoStream: boolean;
}

interface SelectOption {
  value: string;
  labelKey: string;
}

@Component({
  selector: 'app-language-party-create-modal',
  standalone: true,
  imports: [HlmCheckbox, HlmNativeSelect, HlmInput, HlmButton, FormsModule, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      (click)="closeModal()"
      (keydown.escape)="closeModal()"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-party-create-title"
      [attr.aria-describedby]="submissionError() ? 'language-party-create-error' : null"
      [attr.aria-busy]="submitting()"
    >
      <div
        class="w-full max-w-md bg-surface-200 border border-surface-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        (click)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
        role="document"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
          <h2 id="language-party-create-title" class="text-xl font-bold text-text-primary">
            {{ 'languageParty.modalTitle' | t }}
          </h2>
          <button
            hlmBtn
            type="button"
            (click)="closeModal()"
            [disabled]="submitting()"
            class="text-text-muted hover:text-text-primary transition-colors p-2 rounded-full hover:bg-surface-100 disabled:opacity-50"
            [attr.aria-label]="'languageParty.cancelBtn' | t"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 flex flex-col gap-5 overflow-y-auto">
          <p class="text-sm text-text-secondary mb-2">{{ 'languageParty.modalSubtitle' | t }}</p>

          @if (submissionError()) {
            <p
              id="language-party-create-error"
              role="alert"
              aria-live="assertive"
              class="rounded-app border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {{ submissionError() }}
            </p>
          }

          <!-- Title Input -->
          <div class="flex flex-col gap-2">
            <label for="partyTitle" class="text-sm font-medium text-text-secondary">
              {{ 'languageParty.roomTitleLabel' | t }}
            </label>
            <input
              hlmInput
              id="partyTitle"
              type="text"
              [(ngModel)]="title"
              [disabled]="submitting()"
              [placeholder]="'languageParty.roomTitlePlaceholder' | t"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              maxlength="100"
            />
          </div>

          <!-- Language Pair Select -->
          <div class="flex flex-col gap-2">
            <label for="langPair" class="text-sm font-medium text-text-secondary">
              {{ 'languageParty.languagePairLabel' | t }}
            </label>
            <hlm-native-select
              selectId="langPair"
              [(ngModel)]="languagePair"
              [disabled]="submitting()"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              selectClass="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              @for (option of languagePairOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </hlm-native-select>
          </div>

          <!-- Topic Select -->
          <div class="flex flex-col gap-2">
            <label for="topicTag" class="text-sm font-medium text-text-secondary">
              {{ 'languageParty.topicLabel' | t }}
            </label>
            <hlm-native-select
              selectId="topicTag"
              [(ngModel)]="topicTag"
              [disabled]="submitting()"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              selectClass="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              @for (option of topicOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </hlm-native-select>
          </div>

          <!-- Level Select -->
          <div class="flex flex-col gap-2">
            <label for="levelSelect" class="text-sm font-medium text-text-secondary">
              {{ 'languageParty.levelLabel' | t }}
            </label>
            <hlm-native-select
              selectId="levelSelect"
              [(ngModel)]="level"
              [disabled]="submitting()"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              selectClass="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              @for (option of levelOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </hlm-native-select>
          </div>

          <!-- Video Stream Toggle -->
          <label
            for="isVideoStream"
            class="flex items-center gap-3 text-sm font-medium text-text-secondary"
          >
            <hlm-checkbox
              inputId="isVideoStream"
              [(ngModel)]="isVideoStream"
              [disabled]="submitting()"
              class="h-4 w-4 rounded border-surface-100 bg-surface-300 text-primary focus:ring-primary"
            />
            {{ 'languageParty.videoStreamLabel' | t }}
          </label>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-surface-100 flex flex-wrap justify-end gap-3 bg-surface-100/50">
          <button
            hlmBtn
            type="button"
            (click)="closeModal()"
            [disabled]="submitting()"
            class="px-5 py-2.5 rounded-xl font-bold text-text-secondary hover:bg-surface-100 transition-colors disabled:opacity-50"
          >
            {{ 'languageParty.cancelBtn' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            (click)="submit()"
            [disabled]="!isValid() || submitting()"
            [attr.aria-busy]="submitting()"
            class="px-5 py-2.5 rounded-xl font-bold text-on-fill bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            {{ 'languageParty.launchBtn' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LanguagePartyCreateModalComponent {
  readonly closed = output<void>();
  readonly created = output<LanguagePartyCreatePayload>();
  readonly submitting = input(false);
  readonly submissionError = input<string | null>(null);

  readonly LANGUAGE_PAIR_OPTIONS: readonly SelectOption[] = [
    { value: 'en-es', labelKey: 'audioRoom.languagePair.en-es' },
    { value: 'en-fr', labelKey: 'audioRoom.languagePair.en-fr' },
    { value: 'en-ja', labelKey: 'audioRoom.languagePair.en-ja' },
    { value: 'ar-en', labelKey: 'audioRoom.languagePair.ar-en' },
    { value: 'en-ko', labelKey: 'audioRoom.languagePair.en-ko' },
    { value: 'en-zh', labelKey: 'audioRoom.languagePair.en-zh' },
    { value: 'en-pt', labelKey: 'audioRoom.languagePair.en-pt' },
    { value: 'en-ru', labelKey: 'audioRoom.languagePair.en-ru' },
    { value: 'en-de', labelKey: 'audioRoom.languagePair.en-de' },
    { value: 'en-it', labelKey: 'audioRoom.languagePair.en-it' },
    { value: 'en-hi', labelKey: 'audioRoom.languagePair.en-hi' },
    { value: 'en-tr', labelKey: 'audioRoom.languagePair.en-tr' },
    { value: 'ja-en', labelKey: 'audioRoom.languagePair.ja-en' },
    { value: 'ko-en', labelKey: 'audioRoom.languagePair.ko-en' },
    { value: 'zh-en', labelKey: 'audioRoom.languagePair.zh-en' },
    { value: 'fr-en', labelKey: 'audioRoom.languagePair.fr-en' },
    { value: 'es-en', labelKey: 'audioRoom.languagePair.es-en' },
    { value: 'de-en', labelKey: 'audioRoom.languagePair.de-en' },
    { value: 'pt-en', labelKey: 'audioRoom.languagePair.pt-en' },
    { value: 'it-en', labelKey: 'audioRoom.languagePair.it-en' },
    { value: 'ru-en', labelKey: 'audioRoom.languagePair.ru-en' },
    { value: 'ar-fr', labelKey: 'audioRoom.languagePair.ar-fr' },
    { value: 'fr-ar', labelKey: 'audioRoom.languagePair.fr-ar' },
  ];

  readonly TOPIC_OPTIONS: readonly SelectOption[] = [
    { value: 'Free Talk', labelKey: 'languageParty.topic.FreeTalk' },
    { value: 'Beginners', labelKey: 'languageParty.topic.Beginners' },
    { value: 'Pronunciation', labelKey: 'languageParty.topic.Pronunciation' },
    { value: 'Cultural Exchange', labelKey: 'languageParty.topic.CulturalExchange' },
    { value: 'Grammar Help', labelKey: 'languageParty.topic.GrammarHelp' },
    { value: 'Business English', labelKey: 'languageParty.topic.BusinessEnglish' },
    { value: 'Travel Talk', labelKey: 'languageParty.topic.TravelTalk' },
    { value: 'Music & Film', labelKey: 'languageParty.topic.MusicFilm' },
    { value: 'Food & Cooking', labelKey: 'languageParty.topic.FoodCooking' },
  ];

  readonly LEVEL_OPTIONS: readonly SelectOption[] = [
    { value: 'beginner', labelKey: 'languageParty.level.beginner' },
    { value: 'intermediate', labelKey: 'languageParty.level.intermediate' },
    { value: 'advanced', labelKey: 'languageParty.level.advanced' },
    { value: 'all', labelKey: 'languageParty.level.all' },
  ];

  readonly languagePairOptions = signal<readonly SelectOption[]>(this.LANGUAGE_PAIR_OPTIONS);
  readonly topicOptions = signal<readonly SelectOption[]>(this.TOPIC_OPTIONS);
  readonly levelOptions = signal<readonly SelectOption[]>(this.LEVEL_OPTIONS);

  title = signal<string>('');
  languagePair = signal<string>('en-es');
  topicTag = signal<string>('Free Talk');
  level = signal<string>('all');
  isVideoStream = signal<boolean>(false);

  readonly isValid = computed(
    () =>
      this.title().trim().length > 0 &&
      this.languagePair().length > 0 &&
      this.topicTag().length > 0 &&
      this.level().length > 0,
  );

  closeModal(): void {
    if (this.submitting()) return;
    this.closed.emit();
    this.resetForm();
  }

  submit(): void {
    if (!this.isValid() || this.submitting()) return;

    this.created.emit({
      title: this.title().trim(),
      languagePair: this.languagePair(),
      topicTag: this.topicTag(),
      level: this.level(),
      isVideoStream: this.isVideoStream(),
    });
  }

  private resetForm(): void {
    this.title.set('');
    this.languagePair.set('en-es');
    this.topicTag.set('Free Talk');
    this.level.set('all');
    this.isVideoStream.set(false);
  }
}
