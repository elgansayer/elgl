import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  standalone: true,
  selector: 'app-app-language-selector',
  imports: [CommonModule, TranslatePipe],
  template: `
<div class="relative" #container>
  <button
    class="rounded-full bg-neutral-800 p-2 text-white shadow-lg hover:bg-neutral-700 transition-colors"
    (click)="toggle()"
    aria-label="Select app language"
  >
    🌐
  </button>
  @if (isOpen()) {
    <div
      class="absolute end-0 mt-2 w-56 rounded-lg bg-neutral-900 border border-neutral-700 shadow-xl z-[100] max-h-72 overflow-hidden flex flex-col"
      (click)="$event.stopPropagation()"
    >
      <div class="p-2 text-sm font-semibold text-neutral-300 border-b border-neutral-700">
        {{ 'lang.selectTitle' | t }}
      </div>
      <div class="px-2 pb-1">
        <input
          type="text"
          [value]="search()"
          (input)="search.set(($event.target as HTMLInputElement).value)"
          placeholder="{{ 'lang.searchPlaceholder' | t }}"
          class="w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-white placeholder-neutral-500"
        />
      </div>
      <div class="overflow-y-auto flex-1">
        @for (lang of filteredLangs(); track lang.code) {
          <button
            class="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-neutral-800 transition-colors"
            [class.text-blue-400]="i18n.currentLang() === lang.code"
            [class.text-white]="i18n.currentLang() !== lang.code"
            (click)="select(lang.code)"
          >
            <span>{{ lang.flag }}</span>
            <span>{{ lang.name }}</span>
          </button>
        }
        @if (filteredLangs().length === 0) {
          <div class="px-3 py-2 text-xs text-neutral-400">{{ 'lang.noResults' | t }}</div>
        }
      </div>
      <!-- Custom code entry -->
      <div class="p-2 border-t border-neutral-700 flex gap-1">
        <input
          type="text"
          [value]="custom()"
          (input)="custom.set(($event.target as HTMLInputElement).value)"
          placeholder="{{ 'lang.customPlaceholder' | t }}"
          class="flex-1 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-white placeholder-neutral-500"
        />
        <button
          (click)="applyCustom()"
          class="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          {{ 'lang.applyCustom' | t }}
        </button>
      </div>
    </div>
  }
</div>
  `
})
export class AppLanguageSelectorComponent {
  readonly i18n = inject(I18nService);

  isOpen = signal(false);
  search = signal('');
  custom = signal('');

  readonly filteredLangs = () => {
    const s = this.search().toLowerCase();
    return this.i18n.availableLanguages.filter(l =>
      l.code.toLowerCase().includes(s) ||
      l.name.toLowerCase().includes(s) ||
      l.nativeName.toLowerCase().includes(s)
    );
  };

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  select(code: string): void {
    this.i18n.setLanguage(code);
    this.isOpen.set(false);
    this.search.set('');
    this.custom.set('');
  }

  applyCustom(): void {
    const code = this.custom().trim();
    if (!code) return;
    this.i18n.setLanguage(code);
    this.isOpen.set(false);
    this.search.set('');
    this.custom.set('');
  }
}
