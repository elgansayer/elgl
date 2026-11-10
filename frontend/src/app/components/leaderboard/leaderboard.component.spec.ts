import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Pipe, PipeTransform } from '@angular/core';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LeaderboardComponent } from './leaderboard.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('LeaderboardComponent', () => {
  let fixture: ComponentFixture<LeaderboardComponent>;
  let httpTesting: HttpTestingController;

  const API_URL = `${environment.apiUrl}/leaderboard/weekly?limit=20`;

  const mockWeekly = {
    correctors: [
      {
        user_id: 'user-1',
        display_name: 'Alice',
        avatar_url: 'https://example.com/alice.png',
        score: 12,
      },
      {
        user_id: 'user-2',
        display_name: 'Bob',
        avatar_url: null,
        score: 8,
      },
    ],
    study_hours: [
      {
        user_id: 'user-3',
        display_name: 'Charlie',
        avatar_url: 'https://example.com/charlie.png',
        score: 4.5,
      },
      {
        user_id: 'user-4',
        display_name: 'Dana',
        avatar_url: null,
        score: 2,
      },
    ],
  };

  function flushRequest(data: unknown) {
    const req = httpTesting.expectOne(API_URL);
    req.flush(data as never);
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
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
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

    flushRequest({ correctors: [], study_hours: [] });
  });

  it('should call the weekly leaderboard endpoint and show both rankings', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    const req = httpTesting.expectOne(API_URL);
    expect(req.request.method).toBe('GET');
    req.flush(mockWeekly);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('leaderboard.weekly_title');
    expect(element.textContent).toContain('leaderboard.weekly_correctors');
    expect(element.textContent).toContain('leaderboard.weekly_study_hours');
    expect(element.textContent).toContain('Alice');
    expect(element.textContent).toContain('Bob');
    expect(element.textContent).toContain('Charlie');
    expect(element.textContent).toContain('Dana');
    expect(element.textContent).toContain('12 leaderboard.corrections');
    expect(element.textContent).toContain('4.5 leaderboard.hours');
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

  it('should show empty states when there are no rankings', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest({ correctors: [], study_hours: [] });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('leaderboard.empty_correctors');
    expect(element.textContent).toContain('leaderboard.empty_study_hours');
  });

  it('should display rank numbers starting from 1 in each ranking', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest(mockWeekly);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const ranks = Array.from(element.querySelectorAll('.text-primary-ink')).map(
      (node) => node.textContent?.trim(),
    );
    expect(ranks).toEqual(['1', '2', '1', '2']);
  });

  it('should show avatar initials when no avatar_url', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest(mockWeekly);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('B');
    expect(element.textContent).toContain('D');
  });

  it('should expose correctors and study hours signals', async () => {
    fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();

    flushRequest(mockWeekly);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.correctors().length).toBe(2);
    expect(fixture.componentInstance.correctors()[0].display_name).toBe('Alice');
    expect(fixture.componentInstance.studyHours().length).toBe(2);
    expect(fixture.componentInstance.studyHours()[0].display_name).toBe(
      'Charlie',
    );
  });
});
