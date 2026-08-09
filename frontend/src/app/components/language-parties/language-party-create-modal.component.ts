import { Component, computed, output, signal } from '@angular/core';
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
  imports: [FormsModule, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      (click)="closeModal()"
      (keydown.escape)="closeModal()"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-md bg-[#121212] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        (click)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
        role="document"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 class="text-xl font-bold text-slate-100">{{ 'languageParty.modalTitle' | t }}</h2>
          <button
            (click)="closeModal()"
            class="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-800"
            [attr.aria-label]="'languageParty.cancelBtn' | t"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 flex flex-col gap-5 overflow-y-auto">
          <p class="text-sm text-slate-400 mb-2">{{ 'languageParty.modalSubtitle' | t }}</p>

          <!-- Title Input -->
          <div class="flex flex-col gap-2">
            <label for="partyTitle" class="text-sm font-medium text-slate-300">
              {{ 'languageParty.roomTitleLabel' | t }}
            </label>
            <input
              id="partyTitle"
              type="text"
              [(ngModel)]="title"
              [placeholder]="'languageParty.roomTitlePlaceholder' | t"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              maxlength="100"
            />
          </div>

          <!-- Language Pair Select -->
          <div class="flex flex-col gap-2">
            <label for="langPair" class="text-sm font-medium text-slate-300">
              {{ 'languageParty.languagePairLabel' | t }}
            </label>
            <select
              id="langPair"
              [(ngModel)]="languagePair"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none"
            >
              @for (option of languagePairOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </select>
          </div>

          <!-- Topic Select -->
          <div class="flex flex-col gap-2">
            <label for="topicTag" class="text-sm font-medium text-slate-300">
              {{ 'languageParty.topicLabel' | t }}
            </label>
            <select
              id="topicTag"
              [(ngModel)]="topicTag"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none"
            >
              @for (option of topicOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </select>
          </div>

          <!-- Level Select -->
          <div class="flex flex-col gap-2">
            <label for="levelSelect" class="text-sm font-medium text-slate-300">
              {{ 'languageParty.levelLabel' | t }}
            </label>
            <select
              id="levelSelect"
              [(ngModel)]="level"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none"
            >
              @for (option of levelOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </select>
          </div>

          <!-- Video Stream Toggle -->
          <label
            for="isVideoStream"
            class="flex items-center gap-3 text-sm font-medium text-slate-300"
          >
            <input
              id="isVideoStream"
              type="checkbox"
              [(ngModel)]="isVideoStream"
              class="h-4 w-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
            />
            {{ 'languageParty.videoStreamLabel' | t }}
          </label>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
          <button
            (click)="closeModal()"
            class="px-5 py-2.5 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {{ 'languageParty.cancelBtn' | t }}
          </button>
          <button
            (click)="submit()"
            [disabled]="!isValid()"
            class="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
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

  readonly isValid = computed(() =>
    this.title().trim().length > 0
    && this.languagePair().length > 0
    && this.topicTag().length > 0
    && this.level().length > 0,
  );

  closeModal(): void {
    this.closed.emit();
    this.resetForm();
  }

  submit(): void {
    if (!this.isValid()) return;

    this.created.emit({
      title: this.title().trim(),
      languagePair: this.languagePair(),
      topicTag: this.topicTag(),
      level: this.level(),
      isVideoStream: this.isVideoStream(),
    });

    this.closeModal();
  }

  private resetForm(): void {
    this.title.set('');
    this.languagePair.set('en-es');
    this.topicTag.set('Free Talk');
    this.level.set('all');
    this.isVideoStream.set(false);
  }
}
