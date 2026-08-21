import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, signal, computed, inject, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Lesson, LessonService } from '../../services/lesson.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-lesson-manager',
  imports: [HlmTextarea, HlmInput, HlmButton, CommonModule, FormsModule, TranslatePipe],
  templateUrl: './lesson-manager.component.html',
})
export class LessonManagerComponent {
  private lessonService = inject(LessonService);
  private i18n = inject(I18nService);

  private refreshTrigger = signal(0);

  private lessonsResource = resource({
    params: () => this.refreshTrigger(),
    loader: () => this.lessonService.listLessons(),
  });

  lessons = computed(() => this.lessonsResource.value() ?? []);

  editLesson = signal<Lesson | null>(null);
  isNew = signal(false);
  isSaving = signal(false);
  isUploading = signal(false);

  form = {
    title: '',
    description: '',
    language_code: '',
    difficulty_level: 0,
    content_json: '',
    cover_image_url: '',
    audio_url: '',
  };

  refresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  startCreate(): void {
    this.isNew.set(true);
    this.editLesson.set(null);
    this.form = {
      title: '',
      description: '',
      language_code: '',
      difficulty_level: 0,
      content_json: '',
      cover_image_url: '',
      audio_url: '',
    };
  }

  startEdit(lesson: Lesson): void {
    this.isNew.set(false);
    this.editLesson.set(lesson);
    this.form = {
      title: lesson.title,
      description: lesson.description ?? '',
      language_code: lesson.language_code,
      difficulty_level: lesson.difficulty_level ?? 0,
      content_json: JSON.stringify(lesson.content_json ?? {}),
      cover_image_url: lesson.cover_image_url ?? '',
      audio_url: lesson.audio_url ?? '',
    };
  }

  cancelEdit(): void {
    this.editLesson.set(null);
    this.isNew.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.title || !this.form.language_code) {
      alert(this.i18n.translate('admin.lessons.error_missing_required'));
      return;
    }

    let contentJson: Record<string, unknown> = {};
    try {
      if (this.form.content_json) {
        contentJson = JSON.parse(this.form.content_json);
      }
    } catch {
      alert(this.i18n.translate('admin.lessons.error_invalid_json'));
      return;
    }

    const payload: Partial<Lesson> = {
      title: this.form.title,
      description: this.form.description || undefined,
      language_code: this.form.language_code,
      difficulty_level: this.form.difficulty_level,
      content_json: contentJson,
      cover_image_url: this.form.cover_image_url || undefined,
      audio_url: this.form.audio_url || undefined,
    };

    this.isSaving.set(true);
    try {
      const activeLesson = this.editLesson();
      if (this.isNew()) {
        await this.lessonService.createLesson(payload);
      } else if (activeLesson) {
        await this.lessonService.updateLesson(activeLesson.id, payload);
      }
      this.cancelEdit();
      this.refresh();
    } finally {
      this.isSaving.set(false);
    }
  }

  async delete(lesson: Lesson): Promise<void> {
    const confirmMsg = this.i18n.translate('admin.lessons.delete_confirm');
    if (!confirm(confirmMsg)) return;
    await this.lessonService.deleteLesson(lesson.id);
    this.refresh();
  }

  private getFile(event: Event): File | null {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.files) {
      return target.files.item(0);
    }
    return null;
  }

  async onCoverFileSelected(event: Event): Promise<void> {
    const file = this.getFile(event);
    if (!file) return;
    this.isUploading.set(true);
    try {
      this.form.cover_image_url = await this.lessonService.uploadFile(file);
    } finally {
      this.isUploading.set(false);
    }
  }

  async onAudioFileSelected(event: Event): Promise<void> {
    const file = this.getFile(event);
    if (!file) return;
    this.isUploading.set(true);
    try {
      this.form.audio_url = await this.lessonService.uploadFile(file);
    } finally {
      this.isUploading.set(false);
    }
  }
}
