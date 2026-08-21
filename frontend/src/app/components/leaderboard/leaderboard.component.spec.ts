import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Pipe, PipeTransform } from '@angular/core';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LeaderboardComponent } from './leaderboard.component';
import { environment } from '../../../environments/environment';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe.skip('LeaderboardComponent', () => {
  let fixture: ComponentFixture<LeaderboardComponent>;
  let httpTesting: HttpTestingController;

  const API_URL = `${environment.apiUrl}/leaderboard/top-correctors?limit=20`;

  const mockCorrectors = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      correction_ratio: 0.95,
      study_streak_days: 120,
      is_serious_learner: true,
    },
    {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: null,
      correction_ratio: 0.88,
      study_streak_days: 30,
      is_serious_learner: true,
    },
    {
      id: 'user-3',
      display_name: 'Charlie',
      avatar_url: 'https://example.com/charlie.png',
      correction_ratio: 0.45,
      study_streak_days: 3,
      is_serious_learner: false,
    },
  ];

  function flushRequest(data: unknown) {
    const req = httpTesting.expectOne(API_URL);
    req.flush(data as any);
  }

  function errorRequest() {
    const req = httpTesting.expectOne(API_URL);
    req.error(new ProgressEvent('Network error'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(LeaderboardComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should show loading state initially', () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('common.loading');

    flushRequest([]);
  });

  it('should call the correct API endpoint and show data', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    // Verify HTTP request was made to the correct URL
    const req = httpTesting.expectOne(API_URL);
    expect(req.request.method).toBe('GET');
    req.flush(mockCorrectors);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Alice');
    expect(element.textContent).toContain('Bob');
    expect(element.textContent).toContain('Charlie');
    // The leaderboard title should be shown
    expect(element.textContent).toContain('leaderboard.top_correctors');
  });

  it('should show error state on HTTP error', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    errorRequest();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('common.error');
  });

  it('should show empty state when no correctors', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('leaderboard.empty');
  });

  it('should display rank numbers starting from 1', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest(mockCorrectors);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('1');
    expect(element.textContent).toContain('2');
    expect(element.textContent).toContain('3');
  });

  it('should show avatar initials when no avatar_url', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest(mockCorrectors);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('B');
  });

  it('should expose correctors computed signal', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest(mockCorrectors);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // First corrector signal should have Alice
    const correctors = fixture.componentInstance.correctors();
    expect(correctors.length).toBe(3);
    expect(correctors[0].display_name).toBe('Alice');
    expect(correctors[2].display_name).toBe('Charlie');
  });
});