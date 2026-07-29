import { Component, inject, input, output, resource } from '@angular/core';
import { I18nService } from '../services/i18n.service';
import { TranslatePipe } from '../services/translate.pipe';

export interface InterestVocabulary {
  id: string;
  name: string;
  vocabulary: { word: string; translation: string }[];
}

@Component({
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2">
      @for (interest of interests(); track interest.id) {
        <button
          class="px-4 py-2 rounded-full border-2 transition-colors"
          [class.bg-purple-600]="selectedIds().includes(interest.id)"
          [class.border-purple-500]="selectedIds().includes(interest.id)"
          [class.border-slate-600]="!selectedIds().includes(interest.id)"
          (click)="toggleInterest(interest.id)"
        >
          {{ interest.name }}
        </button>
      }
    </div>
    <button
      class="mt-4 px-6 py-2 bg-purple-700 text-white rounded-lg"
      (click)="confirmSelection()"
    >
      {{ 'interests.save' | t }}
    </button>
  `,
})
export class InterestsSelectComponent {
  private i18n = inject(I18nService);
  targetLanguage = input.required<string>();
  interestsSaved = output<void>();

  selectedIds = new Set<string>();
  interests = resource<InterestVocabulary[], { language: string }>({
    request: () => ({ language: this.targetLanguage() }),
    loader: async ({ request }) => {
      const response = await fetch(
        `/api/interests?language=${request.language}`,
        {
          headers: { Authorization: `Bearer ${this.i18n.getToken()}` },
        },
      );
      if (!response.ok) throw new Error('Failed to load interests');
      return response.json();
    },
  });

  toggleInterest(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  async confirmSelection(): Promise<void> {
    const ids = Array.from(this.selectedIds);
    const response = await fetch('/api/interests/select', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.i18n.getToken()}`,
      },
      body: JSON.stringify({ interestIds: ids }),
    });
    if (response.ok) {
      this.interestsSaved.emit();
    }
  }
}
