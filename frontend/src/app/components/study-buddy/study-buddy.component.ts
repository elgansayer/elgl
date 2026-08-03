import { Component, inject, signal, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { StudyBuddyService, StudyBuddyMatch } from '../../services/study-buddy.service';

@Component({
  selector: 'app-study-buddy',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="p-4">
      <h2 class="text-xl font-bold">{{ 'studyBuddy.title' | t }}</h2>
      <p>{{ 'studyBuddy.description' | t }}</p>

      <button class="btn-primary mt-4" (click)="requestBuddy()">
        {{ 'studyBuddy.findBuddy' | t }}
      </button>

      @if (matches().length) {
        <div class="mt-6">
          <h3 class="font-semibold mb-2">{{ 'studyBuddy.potentialMatches' | t }}</h3>
          @for (user of matches(); track user.id) {
            <div class="flex items-center gap-3 p-2 bg-surface rounded mb-2">
              <img
                [src]="user.avatar_url || ''"
                alt=""
                class="w-10 h-10 rounded-full object-cover"
                loading="lazy"
              />
              <span>{{ user.display_name }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class StudyBuddyComponent {
  private sbService = inject(StudyBuddyService);
  matches = signal<StudyBuddyMatch[]>([]);

  constructor() {
    afterNextRender(() => {
      this.sbService.getMatches().then((data) => this.matches.set(data));
    });
  }

  requestBuddy(): void {
    const payload: { partnerId: string } = { partnerId: 'placeholder' };
    this.sbService.requestBuddy(payload);
  }
}
