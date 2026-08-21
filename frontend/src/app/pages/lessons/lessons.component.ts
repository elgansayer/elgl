import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { LessonsService } from '../../services/lessons.service';
import type { Lesson } from './lessons.model';

@Component({
  selector: 'app-lessons',
  imports: [TranslatePipe],
  template: `
    <div class="ps-4 pe-4 py-6">
      <h1 class="text-lg font-bold mb-4">{{ 'lessons.title' | t }}</h1>

      @for (lesson of lessons(); track lesson.id) {
        <div class="ps-4 pe-4 py-3 mb-2 rounded-lg bg-surface-elevated border-s-2 border-accent">
          <h2 class="font-medium">{{ lesson.titleKey | t }}</h2>
          <p class="text-sm text-on-surface-secondary">
            {{ lesson.descriptionKey | t }}
          </p>
          <div class="flex items-center gap-2 mt-2">
            <span class="bg-accent/20 px-2 py-1 text-xs rounded">{{
              lesson.proficiencyLevel | t
            }}</span>
            <span class="text-xs text-on-surface-secondary"
              >{{ lesson.wordCount }} {{ 'lessons.words' | t }}</span
            >
            @if (lesson.completed) {
              <span class="ms-auto text-success text-sm">{{ 'lessons.completed' | t }}</span>
            }
          </div>
        </div>
      } @empty {
        <p class="text-on-surface-secondary">{{ 'lessons.none' | t }}</p>
      }
    </div>
  `,
})
export class LessonsComponent {
  private lessonsService = inject(LessonsService);
  readonly lessons = signal<Lesson[]>(this.lessonsService.getLessons());
}
