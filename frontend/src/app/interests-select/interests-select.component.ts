import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, output, resource, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { TranslatePipe } from '../services/translate.pipe';
import { environment } from '../../environments/environment';

export interface InterestVocabulary {
  id: string;
  name: string;
  vocabulary: { word: string; translation: string }[];
}

// i18n translation key used in template
@Component({
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2">
      @for (interest of interests.value(); track interest.id) {
        <button
          hlmBtn
          class="px-4 py-2 rounded-full border-2 transition-colors"
          [class.bg-primary]="selectedIds().has(interest.id)"
          [class.text-on-fill]="selectedIds().has(interest.id)"
          [class.border-primary]="selectedIds().has(interest.id)"
          [class.border-surface-100]="!selectedIds().has(interest.id)"
          (click)="toggleInterest(interest.id)"
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

  selectedIds = signal(new Set<string>());
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

  toggleInterest(id: string): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async confirmSelection(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    const response = await fetch(`${environment.apiUrl}/interests/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}`,
      },
      body: JSON.stringify({ interestIds: ids }),
    });
    if (response.ok) {
      this.interestsSaved.emit();
    }
  }
}
