import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="p-4 max-w-md mx-auto">
      <h1 class="text-2xl font-bold mb-4">{{ 'app.title' | t }} Settings</h1>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">{{ 'lang.label' | t }}</label>
        <select 
          [ngModel]="i18n.currentLang()" 
          (ngModelChange)="onLanguageChange($event)"
          class="w-full p-2 border rounded bg-surface text-foreground"
        >
          @for (lang of i18n.availableLanguages; track lang.code) {
            <option [value]="lang.code">
              {{ lang.flag }} {{ lang.name }} ({{ lang.nativeName }})
            </option>
          }
        </select>
      </div>
    </div>
  `
})
export class SettingsComponent {
  i18n = inject(I18nService);

  onLanguageChange(code: string) {
    this.i18n.setLanguage(code);
  }
}
