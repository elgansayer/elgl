import { convertToParamMap } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LessonsService } from '../../services/lessons.service';
import { LessonsComponent } from './lessons.component';
import type { Lesson, LessonProgress } from './lessons.model';

const LESSON: Lesson = {
  id: 'lesson-1',
  title: 'Introductions',
  description: 'Practise introductions.',
  language_code: 'ja',
  difficulty_level: 1,
  content_json: {
    segments: [
      { title: 'Start', text: 'First segment' },
      { title: 'Practice', text: 'Second segment' },
      { title: 'Finish', text: 'Third segment' },
    ],
  },
};

const PROGRESS: LessonProgress = {
  lesson_id: LESSON.id,
  segment_index: 1,
  completed: false,
  completed_at: null,
  updated_at: '2026-08-26T20:00:00.000Z',
};

describe('LessonsComponent progress', () => {
  let fixture: ComponentFixture<LessonsComponent>;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let service: {
    getLessons: ReturnType<typeof vi.fn>;
    getLesson: ReturnType<typeof vi.fn>;
    getLessonProgress: ReturnType<typeof vi.fn>;
    saveLessonProgress: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ lesson: LESSON.id }));
    service = {
      getLessons: vi.fn().mockReturnValue(of([LESSON])),
      getLesson: vi.fn().mockReturnValue(of(LESSON)),
      getLessonProgress: vi.fn().mockReturnValue(of(PROGRESS)),
      saveLessonProgress: vi.fn().mockImplementation(
        (_id: string, progress: Pick<LessonProgress, 'segment_index' | 'completed'>) =>
          of({
            ...PROGRESS,
            ...progress,
            completed_at: progress.completed ? '2026-08-26T20:01:00.000Z' : null,
          }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [LessonsComponent],
      providers: [
        provideRouter([]),
        { provide: LessonsService, useValue: service },
        {
          provide: AuthService,
          useValue: { currentUser: vi.fn().mockReturnValue(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: routeParams.asObservable(),
            snapshot: { queryParamMap: routeParams.value },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('resumes at the learner persisted segment', () => {
    expect(service.getLesson).toHaveBeenCalledWith(LESSON.id);
    expect(service.getLessonProgress).toHaveBeenCalledWith(LESSON.id);
    expect(fixture.componentInstance.segmentIndex()).toBe(1);
    expect(fixture.componentInstance.currentSegment()?.text).toBe('Second segment');
  });

  it('persists final-segment navigation as completed', async () => {
    fixture.componentInstance.nextSegment();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.saveLessonProgress).toHaveBeenCalledWith(LESSON.id, {
      segment_index: 2,
      completed: true,
    });
    expect(fixture.componentInstance.segmentIndex()).toBe(2);
    expect(fixture.componentInstance.progressSaveError()).toBe(false);
  });

  it('rolls back the visible segment when persistence fails', async () => {
    service.saveLessonProgress.mockReturnValueOnce(
      throwError(() => new Error('storage unavailable')),
    );

    fixture.componentInstance.nextSegment();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.segmentIndex()).toBe(1);
    expect(fixture.componentInstance.progressSaveError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('clamps invalid stale progress to the available lesson content', async () => {
    routeParams.next(convertToParamMap({}));
    fixture.detectChanges();
    await fixture.whenStable();

    service.getLessonProgress.mockReturnValueOnce(
      of({ ...PROGRESS, segment_index: 99 }),
    );
    routeParams.next(convertToParamMap({ lesson: LESSON.id }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.segmentIndex()).toBe(2);
  });
});
