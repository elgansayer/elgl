import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { I18nService } from '../../services/i18n.service';
import { StudyStreakService } from '../../services/study-streak.service';
import { StudyStreakWidgetComponent } from './study-streak-widget.component';

describe('StudyStreakWidgetComponent', () => {
  let component: StudyStreakWidgetComponent;
  let fixture: ComponentFixture<StudyStreakWidgetComponent>;

  const mockStreakService = {
    getStreak: vi.fn().mockReturnValue(of({ streak: 5 })),
    checkin: vi.fn().mockReturnValue(of({ streak: 6 })),
  };

  const mockI18nService = {
    translations: vi.fn().mockReturnValue({}),
    translate: (key: string) => key,
  };

  beforeEach(async () => {
    mockStreakService.getStreak.mockReturnValue(of({ streak: 5 }));
    mockStreakService.checkin.mockReturnValue(of({ streak: 6 }));

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
});
