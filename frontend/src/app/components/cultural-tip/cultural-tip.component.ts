import { Component, inject, input, resource } from '@angular/core';
import { CulturalGuideService } from '../../services/cultural-guide.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-cultural-tip',
  imports: [TranslatePipe],
  template: `
    @if (guideResource.value(); as text) {
      <div
        class="rounded-card border-s-4 border-primary bg-surface-100 px-4 py-3 text-sm leading-relaxed
               text-text-secondary shadow-card sm:px-5 sm:py-4"
        role="region"
        [attr.aria-label]="'culturalGuide.title' | t"
      >
        <h3 class="mb-1 font-semibold text-text-primary">
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

  protected guideResource = resource({
    params: () => ({ language: this.language() }),
    loader: ({ params }) => this.culturalGuideService.fetchGuide(params.language),
  });
}
