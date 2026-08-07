import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { LeaderboardComponent } from './leaderboard.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

const API_URL = '/api/leaderboard/top-correctors?limit=20';

function flushAndStable(
  httpMock: HttpTestingController,
  fixture: ComponentFixture<LeaderboardComponent>,
  data: unknown,
): Promise<void> {
  httpMock.expectOne(API_URL).flush(data);
  return fixture.whenStable();
}

describe('LeaderboardComponent', () => {
  let fixture: ComponentFixture<LeaderboardComponent>;
  let httpMock: HttpTestingController;

  const mockCorrectors = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: null,
      correction_ratio: 0.95,
      study_streak_days: 30,
      is_serious_learner: true,
    },
    {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: 'https://example.com/bob.jpg',
      correction_ratio: 0.88,
      study_streak_days: 5,
      is_serious_learner: false,
    },
    {
      id: 'user-3',
      display_name: 'Charlie',
      avatar_url: 'https://example.com/charlie.jpg',
      correction_ratio: 0.72,
      study_streak_days: 12,
      is_serious_learner: false,
    },
  ];

  const mockI18nService = {
    translate: (key: string, _params?: Record<string, unknown>) => {
      const defaults: Record<string, string> = {
        'leaderboard.top_correctors': 'Top Correctors',
        'leaderboard.ratio': 'Correction Ratio',
        'leaderboard.serious': 'Serious Learner',
        'leaderboard.days': 'days',
        'leaderboard.empty': 'No correctors yet.',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'card.base_classes': 'rounded-xl bg-surface-200',
        'pill.colour_success': 'bg-green-600 text-white',
        'pill.colour_info': 'bg-blue-600 text-white',
        'pill.colour_primary': 'bg-primary text-white',
        'pill.colour_warning': 'bg-yellow-600 text-white',
        'pill.colour_danger': 'bg-red-600 text-white',
        'pill.colour_neutral': 'bg-gray-600 text-white',
      };
      return defaults[key] ?? key;
    },
    currentLang: { set: () => {} },
  } as unknown as I18nService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TranslatePipe,
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaderboardComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    fixture.destroy();
  });

  it('creates the component', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, []);
  });

  it('shows loading state while the request is in flight', () => {
    fixture.detectChanges();
    const loadingEl = fixture.nativeElement.querySelector('p');
    expect(loadingEl.textContent).toContain('Loading...');
    httpMock.expectOne(API_URL).flush([]);
  });

  it('renders the list of correctors after the request completes', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, mockCorrectors);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-card');
    expect(cards.length).toBe(3);
    expect(cards[0].textContent).toContain('Alice');
    expect(cards[0].textContent).toContain('Correction Ratio');
    expect(cards[0].textContent).toContain('0.95');
  });

  it('displays the rank number for each corrector', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, mockCorrectors);
    fixture.detectChanges();

    const ranks = fixture.nativeElement.querySelectorAll('.text-primary');
    expect(ranks.length).toBe(3);
    expect(ranks[0].textContent.trim()).toBe('1');
    expect(ranks[1].textContent.trim()).toBe('2');
    expect(ranks[2].textContent.trim()).toBe('3');
  });

  it('shows the Serious Learner badge only for serious learners', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, mockCorrectors);
    fixture.detectChanges();

    const seriousPills = fixture.nativeElement.querySelectorAll(
      'app-pill[colour="success"]',
    );
    expect(seriousPills.length).toBe(1);
  });

  it('shows study streak days for all correctors', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, mockCorrectors);
    fixture.detectChanges();

    const infoPills = fixture.nativeElement.querySelectorAll(
      'app-pill[colour="info"]',
    );
    expect(infoPills.length).toBe(3);
  });

  it('displays the avatar image when avatar_url is provided', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, [mockCorrectors[1]]);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/bob.jpg');
  });

  it('shows initial letter placeholder when no avatar', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, [mockCorrectors[0]]);
    fixture.detectChanges();

    const placeholder = fixture.nativeElement.querySelector(
      '.flex.items-center.justify-center.text-text-secondary',
    );
    expect(placeholder).toBeTruthy();
    expect(placeholder.textContent.trim()).toBe('A');
  });

  it('shows empty state when no correctors exist', async () => {
    fixture.detectChanges();
    await flushAndStable(httpMock, fixture, []);
    fixture.detectChanges();

    const emptyMsg = fixture.nativeElement.querySelector('.text-text-secondary');
    expect(emptyMsg).toBeTruthy();
    expect(emptyMsg.textContent).toContain('No correctors yet.');
  });

  it('shows error message when the request fails', async () => {
    fixture.detectChanges();
    httpMock.expectOne(API_URL).flush('Server error', {
      status: 500,
      statusText: 'Internal Server Error',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.text-danger');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Error');
  });
});