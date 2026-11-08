import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideRouter, RouterModule } from '@angular/router';
import { HomeComponent } from './home.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { UserService } from '../../services/user.service';
import { StreakMilestoneService } from '../../services/streak-milestone.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { WordOfTheDayComponent } from '../../components/word-of-the-day/word-of-the-day.component';

@Component({ selector: 'app-study-streak-widget', template: '' })
class StudyStreakWidgetStubComponent {}

@Component({ selector: 'app-daily-learning-tip', template: '' })
class DailyLearningTipStubComponent {}

@Component({ selector: 'app-streak-celebration-overlay', template: '' })
class StreakCelebrationOverlayStubComponent {}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  const mockAuthService = {
    currentUser: () => ({ email: 'learner@example.com' }),
    getAccessToken: vi.fn().mockReturnValue('access-token'),
  };

  const mockUserService = {
    getStudyStreak: vi.fn().mockResolvedValue(5),
  };

  const mockStreakMilestoneService = {
    celebrate: vi.fn(),
  };

  const mockI18nService = {
    translations: vi.fn().mockReturnValue({}),
    translate: (key: string) => key,
  };

  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            word: '学ぶ',
            translation: 'to learn',
            language: 'Japanese',
            languageCode: 'ja',
            example: '毎日、新しいことを学びます。',
            date: '2026-08-22',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    TestBed.overrideComponent(HomeComponent, {
      set: {
        imports: [
          RouterModule,
          TranslatePipe,
          WordOfTheDayComponent,
          StudyStreakWidgetStubComponent,
          DailyLearningTipStubComponent,
          StreakCelebrationOverlayStubComponent,
        ],
      },
    });

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        {
          provide: StreakMilestoneService,
          useValue: mockStreakMilestoneService,
        },
        { provide: I18nService, useValue: mockI18nService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(widget.textContent).toContain('学ぶ');
  });

  it("displays the current user's email in the header", () => {
    const header: HTMLElement = fixture.nativeElement.querySelector('header');
    expect(header.textContent).toContain('learner@example.com');
  });
});
