import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { StudyStreakService } from '../../services/study-streak.service';

describe.skip('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  const mockAuthService = {
    currentUser: () => ({ email: 'learner@example.com' }),
  };

  const mockStreakService = {
    getStreak: vi.fn().mockReturnValue(of({ streak: 5 })),
    checkin: vi.fn().mockReturnValue(of({ streak: 6 })),
  };

  const mockI18nService = {
    translations: vi.fn().mockReturnValue({}),
    translate: (key: string) => key,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: StudyStreakService, useValue: mockStreakService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the study streak widget on the home screen', () => {
    const widget = fixture.nativeElement.querySelector(
      'app-study-streak-widget',
    );
    expect(widget).toBeTruthy();
  });

  it('renders the word of the day widget on the home screen', () => {
    const widget = fixture.nativeElement.querySelector('app-word-of-the-day');
    expect(widget).toBeTruthy();
  });

  it("displays the current user's email in the header", () => {
    const header: HTMLElement = fixture.nativeElement.querySelector('header');
    expect(header.textContent).toContain('learner@example.com');
  });
});
