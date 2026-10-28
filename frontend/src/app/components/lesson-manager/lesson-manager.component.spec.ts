import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonManagerComponent } from './lesson-manager.component';
import { Lesson, LessonService } from '../../services/lesson.service';
import { I18nService } from '../../services/i18n.service';

describe('LessonManagerComponent', () => {
  let component: LessonManagerComponent;
  let fixture: ComponentFixture<LessonManagerComponent>;
  let lessonServiceMock: {
    listLessons: ReturnType<typeof vi.fn>;
    createLesson: ReturnType<typeof vi.fn>;
    updateLesson: ReturnType<typeof vi.fn>;
    deleteLesson: ReturnType<typeof vi.fn>;
    uploadFile: ReturnType<typeof vi.fn>;
  };
  let i18nMock: {
    translate: ReturnType<typeof vi.fn>;
  };

  const sampleLesson: Lesson = {
    id: 'lesson-1',
    title: 'Ordering coffee',
    description: 'Polite phrases for cafés.',
    language_code: 'es',
    difficulty_level: 1,
    content_json: { steps: [{ type: 'phrase', text: 'Un café, por favor' }] },
    cover_image_url: 'https://example.com/cover.webp',
    audio_url: 'https://example.com/audio.mp3',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
  };

  beforeEach(async () => {
    lessonServiceMock = {
      listLessons: vi.fn().mockResolvedValue([sampleLesson]),
      createLesson: vi.fn().mockResolvedValue(sampleLesson),
      updateLesson: vi.fn().mockResolvedValue(sampleLesson),
      deleteLesson: vi.fn().mockResolvedValue(undefined),
      uploadFile: vi.fn().mockResolvedValue('https://example.com/file.webp'),
    };

    i18nMock = {
      translate: vi.fn((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [LessonManagerComponent],
      providers: [
        { provide: LessonService, useValue: lessonServiceMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create and load lessons', () => {
    expect(component).toBeTruthy();
    expect(lessonServiceMock.listLessons).toHaveBeenCalled();
    expect(component.lessons()).toEqual([sampleLesson]);
  });

  it('should open Spartan Helm delete confirm dialog when requestDelete is called', () => {
    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();

    component.requestDelete(sampleLesson);
    fixture.detectChanges();

    expect(component.deleteDialogState()).toBe('open');
    expect(component.pendingDeleteLesson()).toBe(sampleLesson);
  });

  it('should cancel delete without invoking deleteLesson service', () => {
    component.requestDelete(sampleLesson);
    fixture.detectChanges();

    component.cancelDelete();
    fixture.detectChanges();

    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();
    expect(lessonServiceMock.deleteLesson).not.toHaveBeenCalled();
  });

  it('should dismiss delete dialog when dialog reports closed state', () => {
    component.requestDelete(sampleLesson);
    fixture.detectChanges();

    component.onDeleteDialogStateChanged('closed');
    fixture.detectChanges();

    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();
    expect(lessonServiceMock.deleteLesson).not.toHaveBeenCalled();
  });

  it('should confirm delete and call deleteLesson service', async () => {
    component.requestDelete(sampleLesson);
    fixture.detectChanges();

    await component.confirmDelete();
    fixture.detectChanges();

    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();
    expect(lessonServiceMock.deleteLesson).toHaveBeenCalledWith('lesson-1');
  });

  it('should enter and cancel create mode', () => {
    component.startCreate();
    expect(component.isNew()).toBe(true);
    expect(component.editLesson()).toBeNull();
    expect(component.form.title).toBe('');

    component.cancelEdit();
    expect(component.isNew()).toBe(false);
  });

  it('should populate form when startEdit is called', () => {
    component.startEdit(sampleLesson);
    expect(component.isNew()).toBe(false);
    expect(component.editLesson()).toBe(sampleLesson);
    expect(component.form.title).toBe('Ordering coffee');
    expect(component.form.language_code).toBe('es');
  });
});
