import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, NO_ERRORS_SCHEMA } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MyStatsComponent } from './my-stats.component';
import { AuthService } from '../../services/auth.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('MyStatsComponent', () => {
  let fixture: ComponentFixture<MyStatsComponent>;
  const mockFetch = vi.fn();

  const mockAuthService = {
    getAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  };

  const mockStatsResponse = {
    study_hours: [
      { day: 'Sun', hours: 0 },
      { day: 'Mon', hours: 1.5 },
      { day: 'Tue', hours: 2 },
      { day: 'Wed', hours: 1 },
      { day: 'Thu', hours: 3.5 },
      { day: 'Fri', hours: 2.5 },
      { day: 'Sat', hours: 4 },
    ],
    messages_sent: 340,
    corrections_count: 45,
    moments_count: 12,
  };

  beforeEach(async () => {
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [MyStatsComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MyStatsComponent, {
        set: { imports: [MockTranslatePipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MyStatsComponent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it('should create', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should fetch stats with auth token', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/stats/me',
      { headers: { Authorization: 'Bearer mock-access-token' } },
    );
  });

  it('should render stats summary cards once loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('340');
    expect(fixture.nativeElement.textContent).toContain('45');
    expect(fixture.nativeElement.textContent).toContain('12');
  });

  it('should show loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stats.myStats.loading');
  });

  it('should show error state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stats.myStats.error');
  });

  it('should show error state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stats.myStats.error');
  });
});