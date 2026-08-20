import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { LessonsService } from '../../services/lessons.service';
import { LessonsComponent } from './lessons.component';

describe('LessonsComponent', () => {
  it('renders lessons and persisted progress from the API', async () => {
    const lessonsService = {
      listLessons: vi.fn().mockResolvedValue([
        {
          id: 'lesson-1',
          title: 'Greetings',
          description: 'Practice a basic greeting.',
          language_code: 'ja',
          difficulty_level: 1,
          progress: {
            progress_percent: 50,
            last_position: 1,
            completed: false,
            completed_at: null,
          },
        },
      ]),
    };

    await TestBed.configureTestingModule({
      imports: [LessonsComponent],
      providers: [
        provideRouter([]),
        { provide: LessonsService, useValue: lessonsService },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LessonsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;

    expect(text).toContain('Greetings');
    expect(text).toContain('50%');
    expect(link.getAttribute('href')).toBe('/lessons/lesson-1');
    expect(progress.getAttribute('aria-valuenow')).toBe('50');
  });
});
