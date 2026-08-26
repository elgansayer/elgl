import { Component, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
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
  imports: [
    FormsModule,
    HlmButton,
    HlmCheckbox,
    HlmDialogImports,
    HlmInput,
    HlmNativeSelect,
    TranslatePipe,
  ],
  template: `
    <hlm-dialog state="open" (closed)="closeModal()">
      <hlm-dialog-content
        *hlmDialogPortal="let ctx"
        [showCloseButton]="false"
        class="w-full max-w-md overflow-hidden border border-surface-100 bg-surface-200 p-0 shadow-2xl sm:max-w-md"
      >
        <hlm-dialog-header
          class="flex-row items-center justify-between gap-4 border-b border-surface-100 px-6 py-4 text-start"
        >
          <div class="min-w-0">
            <h2 hlmDialogTitle class="text-xl font-bold text-text-primary">
              {{ 'audioRoom.modalTitle' | t }}
            </h2>
            <p hlmDialogDescription class="mt-1 text-sm text-text-secondary">
              {{ 'audioRoom.modalSubtitle' | t }}
            </p>
          </div>
          <button
            hlmBtn
            hlmDialogClose
            type="button"
            variant="ghost"
            size="icon-touch"
            class="shrink-0 rounded-full text-text-muted hover:bg-surface-100 hover:text-text-primary"
            [attr.aria-label]="'audioRoom.cancelBtn' | t"
          >
            ✕
          </button>
        </hlm-dialog-header>

        <div class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-2">
            <label for="roomTitle" class="text-sm font-medium text-text-secondary">
              {{ 'audioRoom.roomTitleLabel' | t }}
            </label>
            <input
              hlmInput
              id="roomTitle"
              type="text"
              [(ngModel)]="title"
              [placeholder]="'audioRoom.roomTitlePlaceholder' | t"
              class="w-full rounded-xl border border-surface-100 bg-surface-300 px-4 py-3 text-text-primary placeholder:text-text-muted"
              maxlength="100"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="langPair" class="text-sm font-medium text-text-secondary">
              {{ 'audioRoom.languagePairLabel' | t }}
            </label>
            <hlm-native-select
              selectId="langPair"
              [(ngModel)]="languagePair"
              class="w-full"
              selectClass="w-full rounded-xl border border-surface-100 bg-surface-300 px-4 py-3 text-text-primary"
            >
              @for (option of languagePairOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </hlm-native-select>
          </div>

          <div class="flex flex-col gap-2">
            <label for="topicTag" class="text-sm font-medium text-text-secondary">
              {{ 'audioRoom.topicLabel' | t }}
            </label>
            <hlm-native-select
              selectId="topicTag"
              [(ngModel)]="topicTag"
              class="w-full"
              selectClass="w-full rounded-xl border border-surface-100 bg-surface-300 px-4 py-3 text-text-primary"
            >
              @for (option of topicOptions(); track option.value) {
                <option [value]="option.value">
                  {{ option.labelKey | t }}
                </option>
              }
            </hlm-native-select>
          </div>

          <label
            for="isVideoStream"
            class="flex items-center gap-3 text-sm font-medium text-text-secondary"
          >
            <hlm-checkbox inputId="isVideoStream" [(ngModel)]="isVideoStream" class="h-4 w-4" />
            {{ 'audioRoom.videoStreamLabel' | t }}
          </label>
        </div>

        <hlm-dialog-footer
          class="flex-row justify-end gap-3 border-t border-surface-100 bg-surface-100/50 px-6 py-4"
        >
          <button
            hlmBtn
            hlmDialogClose
            type="button"
            variant="ghost"
            size="touch"
            class="rounded-xl px-5 font-bold"
          >
            {{ 'audioRoom.cancelBtn' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            size="touch"
            (click)="submit()"
            [disabled]="!isValid()"
            class="rounded-xl bg-gradient-to-r from-primary to-secondary px-5 font-bold text-on-fill shadow-lg shadow-primary/20 hover:from-primary/90 hover:to-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ 'audioRoom.launchStageBtn' | t }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
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
  }

  private resetForm(): void {
    this.title.set('');
    this.languagePair.set('en-es');
    this.topicTag.set('Free Talk');
    this.isVideoStream.set(false);
  }
}
