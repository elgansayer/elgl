import { TestBed } from '@angular/core/testing';
import { LanguageChallengesClient } from '../../services/language-challenges.service';
import { UserService } from '../../services/user.service';
import { StudyStreakCounterComponent } from './study-streak-counter.component';

describe('StudyStreakCounterComponent', () => {
  const getStudyStreak = vi.fn();

  async function render(streak: number) {
    getStudyStreak.mockResolvedValue(streak);
    await TestBed.configureTestingModule({
      imports: [StudyStreakCounterComponent],
      providers: [
        { provide: UserService, useValue: { getStudyStreak } },
        { provide: LanguageChallengesClient, useValue: { list: vi.fn().mockResolvedValue([]) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StudyStreakCounterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('uses the singular translation for a one day streak', async () => {
    const element = await render(1);

    expect(element.textContent).toContain('Current study streak: 1 day');
    expect(element.textContent).not.toContain('Current study streak: 1 days');
  });

  it('uses the plural translation for longer streaks', async () => {
    const element = await render(5);

    expect(element.textContent).toContain('Current study streak: 5 days');
  });

  it('names the streak region through the translation layer', async () => {
    const element = await render(3);

    expect(element.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Current study streak',
    );
  });
});
