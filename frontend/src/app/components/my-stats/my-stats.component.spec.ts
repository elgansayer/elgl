import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HlmButton } from '@spartan-ng/helm/button';
import { NgChartsModule } from 'ng2-charts';
import { MyStatsComponent } from './my-stats.component';
import { AuthService } from '../../services/auth.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

function mockCanvasContext(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    const dummyContext = {
      canvas: this,
      measureText: () => ({ width: 0 }),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      rect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createPattern: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      resetTransform: vi.fn(),
      getTransform: vi.fn().mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      clip: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      getLineDash: vi.fn().mockReturnValue([]),
      isPointInPath: vi.fn().mockReturnValue(false),
    };
    return dummyContext as unknown as CanvasRenderingContext2D;
  });
}

describe('MyStatsComponent', () => {
  let fixture: ComponentFixture<MyStatsComponent>;
  const mockFetch = vi.fn();

  const mockAuthService = {
    getAccessToken: vi.fn(),
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
    mockCanvasContext();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      } as unknown as typeof ResizeObserver;
    }

    mockAuthService.getAccessToken.mockReturnValue('mock-access-token');
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [MyStatsComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MyStatsComponent, {
        set: { imports: [HlmButton, NgChartsModule, MockTranslatePipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MyStatsComponent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
    mockAuthService.getAccessToken.mockReset();
  });

  it('should create', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('fetches private stats with the authenticated access token', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/stats/me',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer mock-access-token' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('does not call the API without an authenticated session', async () => {
    mockAuthService.getAccessToken.mockReturnValue(null);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('stats.myStats.error');
  });

  it('renders summary cards and a text equivalent for study-hours and activity charts', async () => {
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
    expect(fixture.nativeElement.textContent).toContain(
      'stats.dayAbbr.mon: 1.5 stats.myStats.hours',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'stats.myStats.messagesSent: 340',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'stats.myStats.correctionsMade: 45',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'stats.myStats.momentsPosted: 12',
    );
    expect(fixture.nativeElement.querySelectorAll('canvas[aria-hidden="true"]')).toHaveLength(2);
  });

  it('computes reactive line chart configuration matching seven-day study hours', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const lineData = fixture.componentInstance['lineChartData']();
    expect(lineData.labels).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(lineData.datasets[0].data).toEqual([0, 1.5, 2, 1, 3.5, 2.5, 4]);
    expect(lineData.datasets[0].label).toBe('Study Hours (This Week)');

    const lineOptions = fixture.componentInstance['lineChartOptions']();
    expect(lineOptions.responsive).toBe(true);
    const yScale = lineOptions.scales?.['y'] as
      | { beginAtZero?: boolean; title?: { text?: string } }
      | undefined;
    expect(yScale?.beginAtZero).toBe(true);
    expect(yScale?.title?.text).toBe('Hours');
  });

  it('computes reactive pie chart configuration matching activity breakdown', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatsResponse),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pieData = fixture.componentInstance['pieChartData']();
    expect(pieData.labels).toEqual(['Messages Sent', 'Corrections Made', 'Moments Posted']);
    expect(pieData.datasets[0].data).toEqual([340, 45, 12]);

    const pieOptions = fixture.componentInstance['pieChartOptions']();
    expect(pieOptions.responsive).toBe(true);
    expect(pieOptions.plugins?.legend?.position).toBe('bottom');
  });

  it('provides zeroed fallback datasets when activity is empty', async () => {
    const emptyStats = {
      study_hours: [
        { day: 'Sun', hours: 0 },
        { day: 'Mon', hours: 0 },
        { day: 'Tue', hours: 0 },
        { day: 'Wed', hours: 0 },
        { day: 'Thu', hours: 0 },
        { day: 'Fri', hours: 0 },
        { day: 'Sat', hours: 0 },
      ],
      messages_sent: 0,
      corrections_count: 0,
      moments_count: 0,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyStats),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const lineData = fixture.componentInstance['lineChartData']();
    expect(lineData.datasets[0].data).toEqual([0, 0, 0, 0, 0, 0, 0]);

    const pieData = fixture.componentInstance['pieChartData']();
    expect(pieData.datasets[0].data).toEqual([0, 0, 0]);
  });

  it('shows an accessible loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status?.textContent).toContain('stats.myStats.loading');
    expect(fixture.nativeElement.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows a retryable error state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('stats.myStats.error');
    expect(alert?.textContent).toContain('common.retry');
  });

  it('shows an error state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stats.myStats.error');
  });

  it('rejects malformed stats instead of rendering misleading values', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockStatsResponse,
          messages_sent: -1,
        }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stats.myStats.error');
    expect(fixture.nativeElement.textContent).not.toContain('-1');
  });

  it('rejects duplicated or incomplete day series', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockStatsResponse,
          study_hours: mockStatsResponse.study_hours.map((entry, index) =>
            index === 6 ? { ...entry, day: 'Sun' } : entry,
          ),
        }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stats.myStats.error');
  });

  it('retries after a transient failure and renders the confirmed response', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatsResponse),
      });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const retry = fixture.nativeElement.querySelector('button');
    expect(retry?.textContent).toContain('common.retry');
    retry.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('340');
  });
});
