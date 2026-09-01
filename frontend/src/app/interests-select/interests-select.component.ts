import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, output, resource, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { TranslatePipe } from '../services/translate.pipe';
import { environment } from '../../environments/environment';

export interface InterestVocabulary {
  id: string | null;
  tag: string;
  name: string;
  vocabulary: { word: string; translation: string }[];
}

// i18n translation key used in template
@Component({
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2">
      @for (interest of interests.value(); track interest.tag) {
        <button
          hlmBtn
          class="px-4 py-2 rounded-full border-2 transition-colors"
          [class.bg-primary]="selectedTags().has(interest.tag)"
          [class.text-on-fill]="selectedTags().has(interest.tag)"
          [class.border-primary]="selectedTags().has(interest.tag)"
          [class.border-surface-100]="!selectedTags().has(interest.tag)"
          (click)="toggleInterest(interest.tag)"
        >
          {{ interest.name }}
        </button>
      }
    </div>
    <button
      hlmBtn
      class="mt-4 px-6 py-2 bg-primary text-on-fill rounded-lg"
      (click)="confirmSelection()"
    >
      {{ 'interests.save' | t }}
    </button>
  `,
})
export class InterestsSelectComponent {
  private authService = inject(AuthService);
  targetLanguage = input.required<string>();
  interestsSaved = output<void>();

  selectedTags = signal(new Set<string>());
  interests = resource<InterestVocabulary[], { language: string }>({
    params: () => ({ language: this.targetLanguage() }),
    loader: async ({ params }) => {
      const response = await fetch(`${environment.apiUrl}/interests?language=${params.language}`, {
        headers: { Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}` },
      });
      if (!response.ok) throw new Error('Failed to load interests');
      return response.json();
    },
    defaultValue: [],
  });

  toggleInterest(tag: string): void {
    this.selectedTags.update((current) => {
      const next = new Set(current);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  async confirmSelection(): Promise<void> {
    const tags = Array.from(this.selectedTags());
    const response = await fetch(`${environment.apiUrl}/interests/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}`,
      },
      body: JSON.stringify({ interestTags: tags }),
    });
    if (response.ok) {
      this.interestsSaved.emit();
    }
  }
}
