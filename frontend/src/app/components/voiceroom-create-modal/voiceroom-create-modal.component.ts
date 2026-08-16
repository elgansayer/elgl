import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

export interface VoiceroomCreatePayload {
  title: string;
  languagePair: string;
  topicTag: string;
  isVideoStream: boolean;
}

interface SelectOption {
  value: string;
  labelKey: string;
}

@Component({
  selector: 'app-voiceroom-create-modal',
  imports: [HlmNativeSelect, HlmInput, HlmButton, FormsModule, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        class="w-full max-w-md bg-surface-200 border border-surface-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-surface-100 flex justify-between items-center">
          <h2 class="text-xl font-bold text-text-primary">{{ 'audioRoom.modalTitle' | t }}</h2>
          <button hlmBtn
            (click)="closeModal()"
            class="text-text-muted hover:text-text-primary transition-colors p-2 rounded-full hover:bg-surface-100"
            [attr.aria-label]="'audioRoom.cancelBtn' | t"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 flex flex-col gap-5">
          <p class="text-sm text-text-secondary mb-2">{{ 'audioRoom.modalSubtitle' | t }}</p>

          <!-- Title Input -->
          <div class="flex flex-col gap-2">
            <label for="roomTitle" class="text-sm font-medium text-text-secondary">
              {{ 'audioRoom.roomTitleLabel' | t }}
            </label>
            <input hlmInput
              id="roomTitle"
              type="text"
              [(ngModel)]="title"
              [placeholder]="'audioRoom.roomTitlePlaceholder' | t"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              maxlength="100"
            />
          </div>

          <!-- Language Pair Select -->
          <div class="flex flex-col gap-2">
            <label for="langPair" class="text-sm font-medium text-text-secondary">
              {{ 'audioRoom.languagePairLabel' | t }}
            </label>
            <hlm-native-select
              selectId="langPair"
              [(ngModel)]="languagePair"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none" selectClass="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
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
              {{ 'audioRoom.topicLabel' | t }}
            </label>
            <hlm-native-select
              selectId="topicTag"
              [(ngModel)]="topicTag"
              class="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none" selectClass="w-full bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              @for (option of topicOptions(); track option.value) {
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
            <input
              id="isVideoStream"
              type="checkbox"
              [(ngModel)]="isVideoStream"
              class="h-4 w-4 rounded border-surface-100 bg-surface-300 text-primary focus:ring-primary"
            />
            {{ 'audioRoom.videoStreamLabel' | t }}
          </label>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-surface-100 flex justify-end gap-3 bg-surface-100/50">
          <button hlmBtn
            (click)="closeModal()"
            class="px-5 py-2.5 rounded-xl font-bold text-text-secondary hover:bg-surface-100 transition-colors"
          >
            {{ 'audioRoom.cancelBtn' | t }}
          </button>
          <button hlmBtn
            (click)="submit()"
            [disabled]="!isValid()"
            class="px-5 py-2.5 rounded-xl font-bold text-on-fill bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            {{ 'audioRoom.launchStageBtn' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class VoiceroomCreateModalComponent {
  readonly closed = output<void>();
  readonly created = output<VoiceroomCreatePayload>();

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
    { value: 'Pronunciation', labelKey: 'audioRoom.topic.Pronunciation' },
    { value: 'Beginners', labelKey: 'audioRoom.topic.Beginners' },
    { value: 'Cultural Exchange', labelKey: 'audioRoom.topic.CulturalExchange' },
    { value: 'Grammar Help', labelKey: 'audioRoom.topic.GrammarHelp' },
    { value: 'Free Talk', labelKey: 'audioRoom.topic.FreeTalk' },
    { value: 'Business English', labelKey: 'audioRoom.topic.BusinessEnglish' },
  ];

  readonly languagePairOptions = signal<readonly SelectOption[]>(this.LANGUAGE_PAIR_OPTIONS);
  readonly topicOptions = signal<readonly SelectOption[]>(this.TOPIC_OPTIONS);

  title = signal<string>('');
  languagePair = signal<string>('en-es');
  topicTag = signal<string>('Free Talk');
  isVideoStream = signal<boolean>(false);

  readonly isValid = computed(
    () =>
      this.title().trim().length > 0 &&
      this.languagePair().length > 0 &&
      this.topicTag().length > 0,
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
      isVideoStream: this.isVideoStream(),
    });

    this.closeModal();
  }

  private resetForm(): void {
    this.title.set('');
    this.languagePair.set('en-es');
    this.topicTag.set('Free Talk');
    this.isVideoStream.set(false);
  }
}
