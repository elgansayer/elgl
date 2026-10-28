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
    title: 'Beginner Japanese Grammar',
    description: 'Basic particles and sentence order',
    language_code: 'ja',
    difficulty_level: 1,
    content_json: { sections: [] },
    cover_image_url: 'https://example.com/cover.jpg',
    audio_url: 'https://example.com/audio.mp3',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    lessonServiceMock = {
      listLessons: vi.fn().mockResolvedValue([sampleLesson]),
      createLesson: vi.fn().mockResolvedValue(sampleLesson),
      updateLesson: vi.fn().mockResolvedValue(sampleLesson),
      deleteLesson: vi.fn().mockResolvedValue(undefined),
      uploadFile: vi.fn().mockResolvedValue('https://example.com/uploaded.png'),
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
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    component.cancelDelete();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders listed lessons from the resource', () => {
    expect(component.lessons()).toHaveLength(1);
    expect(component.lessons()[0].title).toBe('Beginner Japanese Grammar');
  });

  it('opens Spartan Helm confirm dialog when delete is prompted', () => {
    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();

    component.promptDelete(sampleLesson);

    expect(component.deleteDialogState()).toBe('open');
    expect(component.pendingDeleteLesson()).toEqual(sampleLesson);
  });

  it('dismisses dialog without deleting when cancelled', () => {
    component.promptDelete(sampleLesson);
    expect(component.deleteDialogState()).toBe('open');

    component.cancelDelete();

    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();
    expect(lessonServiceMock.deleteLesson).not.toHaveBeenCalled();
  });

  it('dismisses dialog on stateChanged to closed', () => {
    component.promptDelete(sampleLesson);
    expect(component.deleteDialogState()).toBe('open');

    component.onDeleteDialogStateChanged('closed');

    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();
    expect(lessonServiceMock.deleteLesson).not.toHaveBeenCalled();
  });

  it('executes delete and refreshes when confirmed', async () => {
    component.promptDelete(sampleLesson);
    expect(component.deleteDialogState()).toBe('open');

    await component.confirmDelete();

    expect(component.deleteDialogState()).toBe('closed');
    expect(component.pendingDeleteLesson()).toBeNull();
    expect(lessonServiceMock.deleteLesson).toHaveBeenCalledWith('lesson-1');
  });

  it('renders Helm dialog accessible title and actions in DOM when open', async () => {
    component.promptDelete(sampleLesson);
    fixture.detectChanges();
    await fixture.whenStable();

    const titleElement = document.querySelector('[hlmDialogTitle], [data-slot="dialog-title"]');
    expect(titleElement).not.toBeNull();
    expect(titleElement?.textContent).toContain('admin.lessons.delete_confirm');

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-labelledby')).toBe(titleElement?.id);

    const buttons = document.querySelectorAll('hlm-dialog-content button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
