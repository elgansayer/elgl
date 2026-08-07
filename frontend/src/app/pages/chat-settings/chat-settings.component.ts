import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService, LanguageInfo } from '../../services/i18n.service';
import {
  ChatSettingsService,
  InitialMessageFilterSettings,
} from '../../services/chat-settings.service';

@Component({
  selector: 'app-chat-settings',
  standalone: true,
  imports: [CommonModule, TranslatePipe, FormsModule],
  templateUrl: './chat-settings.component.html',
})
export class ChatSettingsComponent implements OnInit {
  private settingsService = inject(ChatSettingsService);
  private i18n = inject(I18nService);

  readonly autoTranslate = this.settingsService.autoTranslate;
  readonly readReceipts = this.settingsService.readReceipts;
  readonly enterToSend = this.settingsService.enterToSend;
  readonly loaded = this.settingsService.loaded;

  readonly initialMessageFilter = this.settingsService.initialMessageFilter;
  readonly filterLoaded = this.settingsService.filterLoaded;

  readonly filterEnabled = signal(false);
  readonly minAge = signal<number | undefined>(undefined);
  readonly maxAge = signal<number | undefined>(undefined);
  readonly selectedNativeLangs = signal<string[]>([]);

  readonly languageSearchQuery = signal('');
  readonly showLanguagePicker = signal(false);

  readonly availableLanguages = computed(() => {
    const query = this.languageSearchQuery().trim().toLowerCase();
    const all = this.i18n.availableLanguages;
    if (!query) return all;
    return all.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.nativeName.toLowerCase().includes(query) ||
        l.code.toLowerCase().includes(query),
    );
  });

  readonly selectedLanguageNames = computed(() => {
    const codes = this.selectedNativeLangs();
    return codes
      .map((c) => this.i18n.availableLanguages.find((l) => l.code === c))
      .filter(Boolean) as LanguageInfo[];
  });

  ngOnInit(): void {
    this.settingsService.loadSettings();
    this.settingsService.loadInitialMessageFilter();
    this.syncFromFilter();
  }

  toggleAutoTranslate(): void {
    this.settingsService.updateSetting('autoTranslate', !this.autoTranslate());
  }

  toggleReadReceipts(): void {
    this.settingsService.updateSetting('readReceipts', !this.readReceipts());
  }

  toggleEnterToSend(): void {
    this.settingsService.updateSetting('enterToSend', !this.enterToSend());
  }

  toggleFilterEnabled(): void {
    const next = !this.filterEnabled();
    this.filterEnabled.set(next);
    this.persistFilter();
  }

  toggleLanguage(code: string): void {
    const current = this.selectedNativeLangs();
    if (current.includes(code)) {
      this.selectedNativeLangs.set(current.filter((c) => c !== code));
    } else {
      this.selectedNativeLangs.set([...current, code]);
    }
    this.persistFilter();
    this.showLanguagePicker.set(false);
    this.languageSearchQuery.set('');
  }

  removeLanguage(code: string): void {
    this.selectedNativeLangs.set(
      this.selectedNativeLangs().filter((c) => c !== code),
    );
    this.persistFilter();
  }

  onMinAgeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = target.value ? parseInt(target.value, 10) : undefined;
    this.minAge.set(val);
    this.persistFilter();
  }

  onMaxAgeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = target.value ? parseInt(target.value, 10) : undefined;
    this.maxAge.set(val);
    this.persistFilter();
  }

  private syncFromFilter(): void {
    const f = this.initialMessageFilter();
    this.filterEnabled.set(f.enabled);
    this.minAge.set(f.min_age);
    this.maxAge.set(f.max_age);
    this.selectedNativeLangs.set(f.native_languages ?? []);
  }

  private persistFilter(): void {
    const update: InitialMessageFilterSettings = {
      enabled: this.filterEnabled(),
      min_age: this.minAge(),
      max_age: this.maxAge(),
      native_languages:
        this.selectedNativeLangs().length > 0
          ? this.selectedNativeLangs()
          : undefined,
    };
    this.settingsService.updateInitialMessageFilter(update);
  }
}
