import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Lesson, LessonService } from '../../services/lesson.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-lesson-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './lesson-manager.component.html',
})
export class LessonManagerComponent implements OnInit {
  private lessonService = inject(LessonService);

  lessons = signal<Lesson[]>([]);
  editLesson = signal<Lesson | null>(null);
  isNew = signal(false);

  form = {
    title: '',
    description: '',
    language_code: '',
    difficulty_level: 0,
    content_json: '',
  };

  ngOnInit() {
    this.loadLessons();
  }

  async loadLessons() {
    const data = await this.lessonService.listLessons();
    this.lessons.set(data);
  }

  startCreate() {
    this.isNew.set(true);
    this.editLesson.set(null);
    this.form = { title: '', description: '', language_code: '', difficulty_level: 0, content_json: '' };
  }

  startEdit(lesson: Lesson) {
    this.isNew.set(false);
    this.editLesson.set(lesson);
    this.form = {
      title: lesson.title,
      description: lesson.description ?? '',
      language_code: lesson.language_code,
      difficulty_level: lesson.difficulty_level ?? 0,
      content_json: JSON.stringify(lesson.content_json ?? {}),
    };
  }

  cancelEdit() {
    this.editLesson.set(null);
    this.isNew.set(false);
  }

  async save() {
    const payload: Partial<Lesson> = {
      title: this.form.title,
      description: this.form.description || undefined,
      language_code: this.form.language_code,
      difficulty_level: this.form.difficulty_level,
      content_json: this.form.content_json ? JSON.parse(this.form.content_json) : {},
    };
    if (this.isNew()) {
      await this.lessonService.createLesson(payload);
    } else if (this.editLesson()) {
      await this.lessonService.updateLesson(this.editLesson()!.id, payload);
    }
    this.cancelEdit();
    this.loadLessons();
  }

  async delete(lesson: Lesson) {
    if (!confirm('Delete this lesson?')) return;
    await this.lessonService.deleteLesson(lesson.id);
    this.loadLessons();
  }
}
