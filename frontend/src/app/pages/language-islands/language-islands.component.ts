import { Component } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-islands',
  standalone: true,
  imports: [TranslatePipe],
  template: `<div class="p-4">{{ 'languageIslands.title' | t }}</div>`,
})
export class LanguageIslandsComponent {}
