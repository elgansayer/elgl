import { Component, inject, input, resource } from '@angular/core';
import { CulturalGuideService } from '../../services/cultural-guide.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-cultural-tip',
  imports: [TranslatePipe],
  template: `
    @if (guideResource.value(); as text) {
      <div
        class="ps-4 pe-4 py-3 rounded-xl bg-surface-2 border-s-4 border-e-0 border-accent
               text-sm leading-relaxed"
        role="region"
        [attr.aria-label]="'culturalGuide.title' | t"
      >
        <h3 class="font-semibold mb-1">
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
