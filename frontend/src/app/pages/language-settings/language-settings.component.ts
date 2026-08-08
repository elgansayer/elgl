import { Component, inject, signal, computed, resource } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService, UserProfile } from '../../services/user.service';
import {
  getLanguageFlag,
  ALL_LANGUAGE_CODES,
} from '../../components/primitives/language-picker/language-picker.component';
import { showToast } from '../../services/toast.service';

interface LangItem {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

@Component({
  selector: 'app-language-settings',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  template: `
    <div class="min-h-screen bg-surface-50">
      <header
        class="sticky top-0 z-10 flex items-center justify-between bg-surface-100 ps-4 pe-4 pt-4 pb-4 border-b border-surface-200"
      >
        <div class="flex items-center gap-3">
          <button
            (click)="goBack()"
            class="p-2 -ms-2 rounded-full hover:bg-surface-200 transition-colors"
            [attr.aria-label]="'common.back' | t"
          >
            <span class="text-xl">←</span>
          </button>
          <h1 class="text-xl font-bold text-text-primary">
            {{ 'languageSettings.title' | t }}
          </h1>
        </div>
      </header>

      <main class="max-w-3xl mx-auto ps-4 pe-4 pt-6 pb-20 space-y-8">
        @if (isSaving()) {
          <div class="fixed top-0 start-0 w-full h-1 bg-surface-200 z-20">
            <div class="h-full bg-primary animate-pulse"></div>
          </div>
        }

        @if (successMessage()) {
          <div
            class="rounded-card border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400"
          >
            {{ successMessage() }}
          </div>
        }
        @if (errorMessage()) {
          <div class="rounded-card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {{ errorMessage() }}
          </div>
        }

        <p class="text-sm text-text-secondary">
          {{ 'languageSettings.description' | t }}
        </p>

        <!-- Interface Language Section -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'languageSettings.interfaceLanguage' | t }}
          </h2>
          <p class="text-xs text-text-secondary">
            {{ 'languageSettings.interfaceLanguageDescription' | t }}
          </p>

          <div
            class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm"
          >
            @for (lang of langs; track lang.code) {
              <button
                type="button"
                (click)="selectUiLang(lang.code)"
                class="w-full flex items-center justify-between p-4 hover:bg-surface-200 transition-colors border-b border-surface-200 last:border-b-0"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">{{ lang.flag }}</span>
                  <div class="text-start">
                    <div class="text-sm font-medium text-text-primary">{{ lang.nativeName }}</div>
                    <div class="text-xs text-text-secondary">{{ lang.name }}</div>
                  </div>
                </div>
                @if (currentLang() === lang.code) {
                  <span
                    class="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full"
                  >
                    ✓ {{ 'common.selected' | t }}
                  </span>
                }
              </button>
            }
          </div>
        </section>

        <!-- Study Target Languages Section -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'languageSettings.studyLanguages' | t }}
          </h2>
          <p class="text-xs text-text-secondary">
            {{ 'languageSettings.studyLanguagesDescription' | t }}
          </p>

          <div class="space-y-3">
            @if (targetLanguages().length > 0) {
              <div class="flex flex-wrap gap-2">
                @for (code of targetLanguages(); track code) {
                  <span
                    class="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 rounded-full"
                  >
                    <span>{{ getFlagForCode(code) }}</span>
                    <span>{{ getLanguageName(code) }}</span>
                    <button
                      type="button"
                      (click)="removeTargetLanguage(code)"
                      class="ms-1 rounded-full hover:bg-red-500/20 text-text-secondary hover:text-red-400 w-5 h-5 inline-flex items-center justify-center text-xs"
                      [attr.aria-label]="
                        'languageSettings.removeLanguage' | t: { lang: getLanguageName(code) }
                      "
                    >
                      ✕
                    </button>
                  </span>
                }
              </div>
            } @else {
              <div
                class="rounded-2xl bg-surface-100 border border-surface-200 p-4 text-center text-sm text-text-secondary"
              >
                {{ 'languageSettings.noStudyLanguages' | t }}
              </div>
            }

            @if (showTargetPicker()) {
              <div class="rounded-2xl bg-surface-100 border border-surface-200 p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-text-primary">{{
                    'languageSettings.addStudyLanguage' | t
                  }}</span>
                  <button
                    type="button"
                    (click)="toggleTargetPicker()"
                    class="text-xs text-text-secondary hover:text-text-primary p-1 rounded-full"
                    [attr.aria-label]="'common.cancel' | t"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  [ngModel]="targetSearchQuery()"
                  (ngModelChange)="setTargetSearchQuery($event)"
                  [placeholder]="'languageSettings.searchLanguages' | t"
                  class="w-full p-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary outline-none"
                />
                <div class="max-h-48 overflow-y-auto space-y-1">
                  @for (langItem of filteredAllLanguages(); track langItem.code) {
                    <button
                      type="button"
                      (click)="addTargetLanguage(langItem.code)"
                      class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-200 transition-colors text-sm text-start"
                    >
                      <span>{{ langItem.flag }}</span>
                      <span class="text-text-primary">{{ langItem.name }}</span>
                      <span class="text-text-secondary text-xs">{{ langItem.nativeName }}</span>
                    </button>
                  }
                  @if (filteredAllLanguages().length === 0) {
                    <div class="text-xs text-text-secondary text-center py-2">
                      {{ 'languageSettings.noResults' | t }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          @if (targetLanguages().length < maxTargetLanguages) {
            <button
              type="button"
              (click)="toggleTargetPicker()"
              class="w-full py-3 rounded-2xl border-2 border-dashed border-surface-200 hover:border-primary/40 text-sm text-text-secondary hover:text-primary transition-colors"
            >
              + {{ 'languageSettings.addStudyLanguage' | t }}
            </button>
          }
        </section>

        <!-- Native Languages Section -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'languageSettings.nativeLanguages' | t }}
          </h2>
          <p class="text-xs text-text-secondary">
            {{ 'languageSettings.nativeLanguagesDescription' | t }}
          </p>

          <div class="space-y-3">
            @if (nativeLanguages().length > 0) {
              <div class="flex flex-wrap gap-2">
                @for (code of nativeLanguages(); track code) {
                  <span
                    class="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-500 text-sm font-medium px-3 py-1.5 rounded-full"
                  >
                    <span>{{ getFlagForCode(code) }}</span>
                    <span>{{ getLanguageName(code) }}</span>
                    <button
                      type="button"
                      (click)="removeNativeLanguage(code)"
                      class="ms-1 rounded-full hover:bg-red-500/20 text-text-secondary hover:text-red-400 w-5 h-5 inline-flex items-center justify-center text-xs"
                      [attr.aria-label]="
                        'languageSettings.removeLanguage' | t: { lang: getLanguageName(code) }
                      "
                    >
                      ✕
                    </button>
                  </span>
                }
              </div>
            } @else {
              <div
                class="rounded-2xl bg-surface-100 border border-surface-200 p-4 text-center text-sm text-text-secondary"
              >
                {{ 'languageSettings.noNativeLanguages' | t }}
              </div>
            }

            @if (showNativePicker()) {
              <div class="rounded-2xl bg-surface-100 border border-surface-200 p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-text-primary">{{
                    'languageSettings.addNativeLanguage' | t
                  }}</span>
                  <button
                    type="button"
                    (click)="toggleNativePicker()"
                    class="text-xs text-text-secondary hover:text-text-primary p-1 rounded-full"
                    [attr.aria-label]="'common.cancel' | t"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  [ngModel]="nativeSearchQuery()"
                  (ngModelChange)="setNativeSearchQuery($event)"
                  [placeholder]="'languageSettings.searchLanguages' | t"
                  class="w-full p-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary outline-none"
                />
                <div class="max-h-48 overflow-y-auto space-y-1">
                  @for (langItem of filteredNativeLanguages(); track langItem.code) {
                    <button
                      type="button"
                      (click)="addNativeLanguage(langItem.code)"
                      class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-200 transition-colors text-sm text-start"
                    >
                      <span>{{ langItem.flag }}</span>
                      <span class="text-text-primary">{{ langItem.name }}</span>
                      <span class="text-text-secondary text-xs">{{ langItem.nativeName }}</span>
                    </button>
                  }
                  @if (filteredNativeLanguages().length === 0) {
                    <div class="text-xs text-text-secondary text-center py-2">
                      {{ 'languageSettings.noResults' | t }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          @if (nativeLanguages().length < maxNativeLanguages) {
            <button
              type="button"
              (click)="toggleNativePicker()"
              class="w-full py-3 rounded-2xl border-2 border-dashed border-surface-200 hover:border-emerald-500/40 text-sm text-text-secondary hover:text-emerald-500 transition-colors"
            >
              + {{ 'languageSettings.addNativeLanguage' | t }}
            </button>
          }
        </section>

        <!-- Save / Reset buttons -->
        @if (isDirty()) {
          <div class="flex items-center gap-3 pt-4">
            <button
              type="button"
              (click)="saveChanges()"
              class="flex-1 py-3 rounded-2xl bg-primary text-white font-semibold text-sm hover:bg-primary-hover transition-colors"
              [disabled]="isSaving()"
            >
              @if (isSaving()) {
                {{ 'common.saving' | t }}
              } @else {
                {{ 'languageSettings.saveChanges' | t }}
              }
            </button>
            <button
              type="button"
              (click)="discardChanges()"
              class="py-3 px-4 rounded-2xl bg-surface-100 border border-surface-200 text-text-secondary text-sm hover:bg-surface-200 transition-colors"
            >
              {{ 'languageSettings.discard' | t }}
            </button>
          </div>
        }
      </main>
    </div>
  `,
})
export class LanguageSettingsComponent {
  private location = inject(Location);
  private userService = inject(UserService);
  readonly i18n = inject(I18nService);

  readonly langs = this.i18n.availableLanguages;
  readonly currentLang = this.i18n.currentLang;

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly showTargetPicker = signal(false);
  readonly showNativePicker = signal(false);

  readonly maxTargetLanguages = 3;
  readonly maxNativeLanguages = 3;

  readonly targetLanguages = signal<string[]>([]);
  readonly nativeLanguages = signal<string[]>([]);
  readonly originalTargetLanguages = signal<string[]>([]);
  readonly originalNativeLanguages = signal<string[]>([]);

  readonly targetSearchQuery = signal('');
  readonly nativeSearchQuery = signal('');

  readonly allLanguages = computed<LangItem[]>(() => {
    try {
      const enNames = new Intl.DisplayNames(['en'], { type: 'language' });
      return ALL_LANGUAGE_CODES.map((code) => {
        let name = code;
        let nativeName = code;
        try {
          name = enNames.of(code) || code;
          const nativeDisplay = new Intl.DisplayNames([code], { type: 'language' });
          nativeName = nativeDisplay.of(code) || name;
        } catch {
          /* fallback */
        }
        return { code, name, nativeName, flag: getLanguageFlag(code) };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return ALL_LANGUAGE_CODES.map((code) => ({
        code,
        name: code,
        nativeName: code,
        flag: getLanguageFlag(code),
      }));
    }
  });

  readonly filteredAllLanguages = computed(() => {
    const query = this.targetSearchQuery().toLowerCase().trim();
    const langs = this.allLanguages();
    if (!query) return langs;
    return langs.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.nativeName.toLowerCase().includes(query) ||
        l.code.toLowerCase().includes(query),
    );
  });

  readonly filteredNativeLanguages = computed(() => {
    const query = this.nativeSearchQuery().toLowerCase().trim();
    const langs = this.allLanguages();
    if (!query) return langs;
    return langs.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.nativeName.toLowerCase().includes(query) ||
        l.code.toLowerCase().includes(query),
    );
  });

  readonly isDirty = computed(() => {
    const t = JSON.stringify(this.targetLanguages());
    const ot = JSON.stringify(this.originalTargetLanguages());
    const n = JSON.stringify(this.nativeLanguages());
    const onVal = JSON.stringify(this.originalNativeLanguages());
    return t !== ot || n !== onVal;
  });

  private profileResource = resource<UserProfile | null, void>({
    loader: async () => {
      try {
        const profile = await this.userService.getMyProfile();
        if (profile) {
          const tl = profile.target_languages || [];
          const nl = profile.native_languages || [];
          this.targetLanguages.set([...tl]);
          this.originalTargetLanguages.set([...tl]);
          this.nativeLanguages.set([...nl]);
          this.originalNativeLanguages.set([...nl]);
          // Sync UI language from backend to keep devices in sync
          if (profile.interface_language && profile.interface_language !== this.currentLang()) {
            await this.i18n.setLanguage(profile.interface_language);
          }
        }
        return profile;
      } catch {
        return null;
      }
    },
  });

  readonly isLoading = computed(() => this.profileResource.isLoading());

  setTargetSearchQuery(value: string): void {
    this.targetSearchQuery.set(value);
  }

  setNativeSearchQuery(value: string): void {
    this.nativeSearchQuery.set(value);
  }

  async selectUiLang(code: string): Promise<void> {
    await this.i18n.setLanguage(code);
    this.successMessage.set(this.i18n.translate('languageSettings.uiLangChanged', { name: code }));
    try {
      await this.userService.updateMyProfile({ interface_language: code });
    } catch {
      // UI language change is already applied locally; backend sync is non-critical
    }
  }

  getFlagForCode(code: string): string {
    return getLanguageFlag(code);
  }

  getLanguageName(code: string): string {
    try {
      const enNames = new Intl.DisplayNames(['en'], { type: 'language' });
      return enNames.of(code) || code;
    } catch {
      return code;
    }
  }

  toggleTargetPicker(): void {
    this.showTargetPicker.update((v) => !v);
    if (this.showTargetPicker()) this.targetSearchQuery.set('');
  }

  toggleNativePicker(): void {
    this.showNativePicker.update((v) => !v);
    if (this.showNativePicker()) this.nativeSearchQuery.set('');
  }

  addTargetLanguage(code: string): void {
    if (this.targetLanguages().includes(code)) return;
    if (this.targetLanguages().length >= this.maxTargetLanguages) {
      this.errorMessage.set(
        this.i18n.translate('languageSettings.maxLanguagesError', {
          count: this.maxTargetLanguages,
        }),
      );
      return;
    }
    this.targetLanguages.update((arr) => [...arr, code]);
    this.showTargetPicker.set(false);
    this.targetSearchQuery.set('');
    this.errorMessage.set('');
  }

  removeTargetLanguage(code: string): void {
    this.targetLanguages.update((arr) => arr.filter((l) => l !== code));
  }

  addNativeLanguage(code: string): void {
    if (this.nativeLanguages().includes(code)) return;
    if (this.nativeLanguages().length >= this.maxNativeLanguages) {
      this.errorMessage.set(
        this.i18n.translate('languageSettings.maxLanguagesError', {
          count: this.maxNativeLanguages,
        }),
      );
      return;
    }
    this.nativeLanguages.update((arr) => [...arr, code]);
    this.showNativePicker.set(false);
    this.nativeSearchQuery.set('');
    this.errorMessage.set('');
  }

  removeNativeLanguage(code: string): void {
    this.nativeLanguages.update((arr) => arr.filter((l) => l !== code));
  }

  async saveChanges(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    try {
      const updated = await this.userService.updateMyProfile({
        target_languages: this.targetLanguages(),
        native_languages: this.nativeLanguages(),
      });
      if (updated) {
        this.originalTargetLanguages.set([...this.targetLanguages()]);
        this.originalNativeLanguages.set([...this.nativeLanguages()]);
      }
      showToast(this.i18n.translate('languageSettings.changesSaved'), 'success', 3000);
      this.successMessage.set(this.i18n.translate('languageSettings.changesSaved'));
    } catch {
      this.errorMessage.set(this.i18n.translate('languageSettings.saveError'));
    } finally {
      this.isSaving.set(false);
    }
  }

  discardChanges(): void {
    this.targetLanguages.set([...this.originalTargetLanguages()]);
    this.nativeLanguages.set([...this.originalNativeLanguages()]);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  goBack(): void {
    this.location.back();
  }
}
