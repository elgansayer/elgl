import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { I18nService } from '../../services/i18n.service';
import { StudyStreakService } from '../../services/study-streak.service';
import { StudyStreakWidgetComponent } from './study-streak-widget.component';

describe('StudyStreakWidgetComponent', () => {
  let component: StudyStreakWidgetComponent;
  let fixture: ComponentFixture<StudyStreakWidgetComponent>;
  let currentStreak = 5;

  const mockStreakService = {
    getStreak: vi.fn().mockImplementation(() => of({ streak: currentStreak })),
    checkin: vi.fn().mockImplementation(() => {
      currentStreak += 1;
      return of({ streak: currentStreak });
    }),
  };

  const mockI18nService = {
    translate: (key: string) => key,
  } as unknown as I18nService;

  beforeEach(async () => {
    currentStreak = 5;
    mockStreakService.getStreak.mockImplementation(() => of({ streak: currentStreak }));
    mockStreakService.checkin.mockImplementation(() => {
      currentStreak += 1;
      return of({ streak: currentStreak });
    });

    await TestBed.configureTestingModule({
      imports: [StudyStreakWidgetComponent],
      providers: [
        { provide: StudyStreakService, useValue: mockStreakService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StudyStreakWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the streak value from the service', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.streakLoading()).toBe(false);
    expect(component.streakValue()).toBe(5);
  });

  it('triggers checkin when the button is clicked', () => {
    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
    button.click();
    expect(mockStreakService.checkin).toHaveBeenCalled();
  });

  it('updates the streak value after checkin', async () => {
    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.streakValue()).toBe(6);
  });

  it('renders the streak value correctly in the DOM', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const streakElement: HTMLElement | null =
      fixture.nativeElement.querySelector('.streak-value');
    expect(streakElement).toBeTruthy();
    expect(streakElement!.textContent).toContain('5');
  });
});
