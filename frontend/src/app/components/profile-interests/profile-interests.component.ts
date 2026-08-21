import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, linkedSignal, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserInterestsService } from '../../services/user-interests.service';

@Component({
  selector: 'app-profile-interests',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2 ps-2 pe-2">
      @for (tag of availableTags.value() ?? []; track tag) {
        <button
          hlmBtn
          type="button"
          (click)="toggle(tag)"
          [class.bg-primary]="selectedTags().includes(tag)"
          [class.text-on-fill]="selectedTags().includes(tag)"
          class="px-3 py-1 rounded-full border-s border-e-0 text-sm transition-colors"
        >
          {{ 'interest.' + tag | t }}
        </button>
      }
    </div>
  `,
})
export class ProfileInterestsComponent {
  private readonly interestsService = inject(UserInterestsService);
  protected readonly currentLanguage = input.required<string>();

  readonly availableTags = resource({
    loader: () =>
      Promise.resolve([
        'photography',
        'cooking',
        'music',
        'travel',
        'sports',
        'gaming',
        'reading',
        'technology',
        'fashion',
        'film',
      ]),
  });

  private readonly loadedTags = resource({
    loader: () => this.interestsService.getUserTags(),
  });

  readonly selectedTags = linkedSignal(() => this.loadedTags.value() ?? []);

  toggle(tag: string): void {
    this.selectedTags.update((prev) => {
      const idx = prev.indexOf(tag);
      if (idx === -1) return [...prev, tag];
      return prev.filter((t) => t !== tag);
    });
    void this.interestsService.updateUserTags(this.selectedTags());
  }
}
