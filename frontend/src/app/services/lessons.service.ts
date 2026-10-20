import { Injectable } from '@angular/core';
import type { Lesson } from '../pages/lessons/lessons.model';

@Injectable({ providedIn: 'root' })
export class LessonsService {
  getLessons(): Lesson[] {
    return [
      {
        id: '1',
        titleKey: 'lessons.basics.title',
        descriptionKey: 'lessons.basics.description',
        wordCount: 10,
        proficiencyLevel: 'beginner',
        completed: false,
      },
      {
        id: '2',
        titleKey: 'lessons.intermediate.title',
        descriptionKey: 'lessons.intermediate.description',
        wordCount: 20,
        proficiencyLevel: 'intermediate',
        completed: true,
      },
    ];
  }
}
