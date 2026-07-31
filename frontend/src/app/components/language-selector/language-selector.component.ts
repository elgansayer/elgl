import { Component, inject, signal, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../services/i18n.service';
import {
  ProficiencyService,
  LanguageSelectionDto,
  ProficiencyLevel,
  isProficiencyLevel,
} from '../../services/proficiency.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div
      class="flex flex-col gap-4 rounded-lg bg-surface p-4"
      role="group"
      aria-label="Language selector"
    >
      <h2 class="text-lg font-bold">{{ 'profile.title' | t }}</h2>

      <!-- Native language -->
      <div class="flex flex-col gap-2">
        <label for="native-lang-select" class="text-sm text-neutral-400">{{
          'nativeLanguage' | t
        }}</label>
        <select
          id="native-lang-select"
          [value]="selectedNativeLang()"
          (change)="selectedNativeLang.set($any($event.target).value)"
          class="rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-white"
        >
          <option value="" disabled>{{ 'lang.selectLanguage' | t }}</option>
          @for (lang of availableLanguages; track lang.code) {
            <option [value]="lang.code">
              {{ lang.flag }} {{ lang.name }}
            </option>
          }
        </select>
      </div>

      <!-- Target languages -->
      <div class="flex flex-col gap-2">
        <span class="text-sm text-neutral-400">{{
          'targetLanguages' | t
        }}</span>

        @for (target of targetLanguages(); track $index) {
          <div class="flex items-center gap-2">
            <select
              [value]="target.language"
              (change)="updateTargetLanguage($index, $any($event.target).value)"
              class="flex-1 rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-white"
            >
              @for (lang of availableLanguages; track lang.code) {
                <option
                  [value]="lang.code"
                  [disabled]="
                    lang.code === selectedNativeLang() ||
                    isLangAlreadyUsed(lang.code, $index)
                  "
                >
                  {{ lang.flag }} {{ lang.name }}
                </option>
              }
            </select>

            <select
              [value]="target.level"
              (change)="updateTargetLevel($index, $any($event.target).value)"
              class="rounded border border-neutral-600 bg-neutral-800 px-2 py-2 text-white"
            >
              @for (lvl of proficiencyLevels; track lvl) {
                <option [value]="lvl">{{ 'level.' + lvl | t }}</option>
              }
            </select>

            <button
              (click)="removeTargetLanguage($index)"
              class="text-sm text-red-400 hover:text-red-300"
              aria-label="Remove language"
            >
              ✕
            </button>
          </div>
        }

        @if (canAddTarget()) {
          <button
            (click)="addTargetLanguage()"
            class="self-start text-sm text-blue-400 hover:text-blue-300"
          >
            + {{ 'addLanguage' | t }}
          </button>
        }
      </div>

      @if (error(); as err) {
        <p class="text-sm text-red-400">{{ err }}</p>
      }

      <button
        (click)="save()"
        [disabled]="saving()"
        class="rounded bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        @if (saving()) {
          {{ 'common.loading' | t }}
        } @else {
          {{ 'profile.saveChangesBtn' | t }}
        }
      </button>
    </div>
  `,
})
export class LanguageSelectorComponent {
  readonly userId = input.required<string>();

  private i18n = inject(I18nService);
  private proficiency = inject(ProficiencyService);

  readonly availableLanguages = this.i18n.availableLanguages;

  selectedNativeLang = signal<string>('');
  targetLanguages = signal<Array<{ language: string; level: ProficiencyLevel }>>([]);

  readonly proficiencyLevels: ProficiencyLevel[] = [
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2',
  ];

  saving = signal(false);
  error = signal<string | null>(null);

  maxTargetLangs = 3;

  canAddTarget = computed(() => this.targetLanguages().length < this.maxTargetLangs);

  addTargetLanguage(): void {
    if (!this.canAddTarget()) return;

    const usedCodes = new Set(
      this.targetLanguages().map((t) => t.language),
    );
    usedCodes.add(this.selectedNativeLang());

    const next = this.availableLanguages.find((l) => !usedCodes.has(l.code));
    if (!next) return;

    this.targetLanguages.update((arr) => [
      ...arr,
      { language: next.code, level: 'A1' },
    ]);
  }

  removeTargetLanguage(index: number): void {
    this.targetLanguages.update((arr) => arr.filter((_, i) => i !== index));
  }

  updateTargetLanguage(index: number, newLang: string): void {
    this.targetLanguages.update((arr) => {
      const copy = [...arr];
      copy[index] = { ...copy[index], language: newLang };
      return copy;
    });
  }

  updateTargetLevel(index: number, newLevel: string): void {
    if (!isProficiencyLevel(newLevel)) return;

    this.targetLanguages.update((arr) => {
      const copy = [...arr];
      copy[index] = { ...copy[index], level: newLevel };
      return copy;
    });
  }

  isLangAlreadyUsed(code: string, skipIndex: number): boolean {
    return this.targetLanguages().some(
      (t, i) => t.language === code && i !== skipIndex,
    );
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);

    try {
      const dto: LanguageSelectionDto = {
        userId: this.userId(),
        nativeLanguage: this.selectedNativeLang(),
        targetLanguages: this.targetLanguages().map((t) => ({
          language: t.language,
          level: t.level,
        })),
      };
      await firstValueFrom(this.proficiency.setLanguagePreferences(dto));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save language preferences';
      this.error.set(message);
    } finally {
      this.saving.set(false);
    }
  }
}
