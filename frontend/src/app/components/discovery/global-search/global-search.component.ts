import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../services/translate.pipe';
import { I18nService } from '../../../services/i18n.service';
import { SearchFilterParams } from '../../../services/discovery.service';

@Component({
  selector: 'app-global-search',
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="flex flex-col gap-4 p-4 bg-surface rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
      <h3 class="text-lg font-bold text-slate-900 dark:text-white">
        {{ 'discovery.global_search_title' | t }}
      </h3>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ 'discovery.native_language' | t }}
        </label>
        <select [ngModel]="nativeLanguage()" (ngModelChange)="nativeLanguage.set($event)" class="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">{{ 'discovery.any_language' | t }}</option>
          @for (lang of i18n.availableLanguages; track lang.code) {
            <option [value]="lang.code">{{ lang.nativeName }} {{ lang.flag }}</option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ 'discovery.target_language' | t }}
        </label>
        <select [ngModel]="targetLanguage()" (ngModelChange)="targetLanguage.set($event)" class="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">{{ 'discovery.any_language' | t }}</option>
          @for (lang of i18n.availableLanguages; track lang.code) {
            <option [value]="lang.code">{{ lang.nativeName }} {{ lang.flag }}</option>
          }
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ 'discovery.proficiency_level' | t }}
        </label>
        <select [ngModel]="level()" (ngModelChange)="level.set($event)" class="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">{{ 'discovery.any_level' | t }}</option>
          @for (lvl of levels; track lvl) {
            <option [value]="lvl">{{ 'levels.' + lvl | t }}</option>
          }
        </select>
      </div>

      <button (click)="applyFilters()" class="mt-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
        {{ 'discovery.search_button' | t }}
      </button>
    </div>
  `
})
export class GlobalSearchComponent {
  readonly i18n = inject(I18nService);
  
  readonly search = output<SearchFilterParams>();

  readonly nativeLanguage = signal<string>('');
  readonly targetLanguage = signal<string>('');
  readonly level = signal<string>('');

  readonly levels = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

  applyFilters(): void {
    this.search.emit({
      native_language: this.nativeLanguage() || undefined,
      target_language: this.targetLanguage() || undefined,
      level: this.level() || undefined
    });
  }
}
