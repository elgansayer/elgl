import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { LessonsService } from '../../services/lessons.service';
import { LessonDetailComponent } from './lesson-detail.component';

describe('LessonDetailComponent', () => {
  it('resumes at the saved section and persists completion', async () => {
    const lessonsService = {
      getLesson: vi.fn().mockResolvedValue({
        id: 'lesson-1',
        title: 'Greetings',
        language_code: 'ja',
        content_json: {
          sections: [
            { title: 'One', body: 'First section' },
            { title: 'Two', body: 'Second section' },
          ],
        },
        progress: {
          progress_percent: 50,
          last_position: 1,
          completed: false,
          completed_at: null,
        },
      }),
      updateProgress: vi.fn().mockResolvedValue({
        progress_percent: 100,
        last_position: 1,
        completed: true,
        completed_at: '2026-08-20T16:00:00.000Z',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [LessonDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'lesson-1' } } },
        },
        { provide: LessonsService, useValue: lessonsService },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LessonDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.activeIndex()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Second section');

    await component.complete();
    fixture.detectChanges();

    expect(lessonsService.updateProgress).toHaveBeenCalledWith('lesson-1', {
      progressPercent: 100,
      lastPosition: 1,
      completed: true,
    });
    expect(component.progress()?.completed).toBe(true);
  });
});
