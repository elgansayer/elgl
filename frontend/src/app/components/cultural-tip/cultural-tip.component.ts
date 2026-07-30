import { Component, inject, input, effect } from '@angular/core';
import { CulturalGuideService } from '../../services/cultural-guide.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-cultural-tip',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (guide(); as text) {
      <div
        class="ps-4 pe-4 py-3 rounded-xl bg-surface-2 border-s-4 border-e-0 border-accent
               text-sm leading-relaxed"
        role="region"
        aria-labelledby="cultural-tip-heading"
      >
        <h3 id="cultural-tip-heading" class="font-semibold mb-1">
          {{ 'culturalGuide.title' | t }}
        </h3>
        <p>{{ text }}</p>
      </div>
    }
  `,
})
export class CulturalTipComponent {
  language = input.required<string>();
  private culturalGuideService = inject(CulturalGuideService);
  private guide = this.culturalGuideService.guide.asReadonly();

  constructor() {
    effect(() => {
      const lang = this.language();
      if (lang) {
        this.culturalGuideService.fetchGuide(lang);
      }
    });
  }
}
