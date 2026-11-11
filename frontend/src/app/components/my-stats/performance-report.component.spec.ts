import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { PerformanceReportComponent } from './performance-report.component';

const REPORT_URL = 'http://127.0.0.1:3000/api/stats/me/report';

function metrics() {
  return [
    { key: 'study_hours', current: 2.5, previous: 1.5 },
    { key: 'messages_sent', current: 12, previous: 5 },
    { key: 'corrections_made', current: 3, previous: 6 },
    { key: 'moments_posted', current: 2, previous: 2 },
    { key: 'lessons_completed', current: 0, previous: 0 },
  ];
}

const firstMomentBadge = {
  code: 'first_moment',
  name: 'First Moment',
  description: 'Share your first Moment.',
  unlocked_at: '2026-11-09T09:00:00.000Z',
};

function report(overrides: Record<string, unknown> = {}) {
  return {
    period: 'week',
    window: { start: '2026-11-03T12:00:00.000Z', end: '2026-11-10T12:00:00.000Z' },
    previous_window: {
      start: '2026-10-27T12:00:00.000Z',
      end: '2026-11-03T12:00:00.000Z',
    },
    metrics: metrics(),
    badges_unlocked: [firstMomentBadge],
    streak_days: 4,
    ...overrides,
  };
}

function okResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}

describe('PerformanceReportComponent', () => {
  let fixture: ComponentFixture<PerformanceReportComponent>;
  const mockFetch = vi.fn();
  const mockAuthService = { getAccessToken: vi.fn() };

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent ?? '';
  }

  function metricTile(key: string): string {
    return fixture.nativeElement.querySelector(`[data-metric="${key}"]`)?.textContent ?? '';
  }

  function periodButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="group"] button'));
  }

  beforeEach(async () => {
    mockAuthService.getAccessToken.mockReturnValue('mock-access-token');
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [PerformanceReportComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PerformanceReportComponent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
    mockAuthService.getAccessToken.mockReset();
  });

  it('requests the weekly report with the access token and never caches it', () => {
    mockFetch.mockResolvedValue(okResponse(report()));

    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledWith(
      `${REPORT_URL}?period=week`,
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer mock-access-token' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('does not call the API without an authenticated session', async () => {
    mockAuthService.getAccessToken.mockReturnValue(null);

    await settle();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(text()).toContain('Failed to load your report. Please try again.');
  });

  describe('with a loaded report', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValue(okResponse(report()));
      await settle();
    });

    it('renders every metric with its current value', () => {
      expect(text()).toContain('Performance report');
      expect(text()).toContain('Compared with the 7 days before');
      expect(metricTile('study_hours')).toContain('Study hours');
      expect(metricTile('study_hours')).toContain('2.5');
      expect(metricTile('messages_sent')).toContain('Messages sent');
      expect(metricTile('messages_sent')).toContain('12');
      expect(metricTile('corrections_made')).toContain('Corrections made');
      expect(metricTile('moments_posted')).toContain('Moments posted');
      expect(metricTile('lessons_completed')).toContain('Lessons completed');
      expect(metricTile('streak_days')).toContain('Current study streak (days)');
      expect(metricTile('streak_days')).toContain('4');
    });

    it('words every trend so direction is never conveyed by an icon or colour alone', () => {
      expect(metricTile('study_hours')).toContain('Up 1 on the previous period');
      expect(metricTile('messages_sent')).toContain('Up 7 on the previous period');
      expect(metricTile('corrections_made')).toContain('Down 3 on the previous period');
      expect(metricTile('moments_posted')).toContain('No change on the previous period');
      expect(metricTile('lessons_completed')).toContain('No change on the previous period');
    });

    it('keeps the trend icons decorative', () => {
      const icons = fixture.nativeElement.querySelectorAll('ng-icon');

      expect(icons).toHaveLength(5);
      for (const icon of Array.from<Element>(icons)) {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('lists the badges unlocked in the period with translated copy and the unlock date', () => {
      const items = fixture.nativeElement.querySelectorAll('ul[role="list"] li');

      expect(text()).toContain('Badges unlocked');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('First Moment');
      expect(items[0].textContent).toContain('Share your first Moment.');
      expect(items[0].textContent).toContain('Unlocked Nov 9, 2026');
    });

    it('marks the weekly period as the pressed choice in a labelled group', () => {
      const group = fixture.nativeElement.querySelector('[role="group"]');
      const [week, month] = periodButtons();

      expect(group.getAttribute('aria-label')).toBe('Report period');
      expect(week.textContent).toContain('Last 7 days');
      expect(week.getAttribute('aria-pressed')).toBe('true');
      expect(month.textContent).toContain('Last 30 days');
      expect(month.getAttribute('aria-pressed')).toBe('false');
    });

    it('loads the monthly report when the period changes', async () => {
      mockFetch.mockResolvedValue(
        okResponse(
          report({
            period: 'month',
            metrics: metrics().map((metric) => ({ ...metric, current: 40 })),
            badges_unlocked: [],
          }),
        ),
      );

      periodButtons()[1].click();
      await settle();

      expect(mockFetch).toHaveBeenLastCalledWith(
        `${REPORT_URL}?period=month`,
        expect.objectContaining({ cache: 'no-store' }),
      );
      expect(periodButtons()[0].getAttribute('aria-pressed')).toBe('false');
      expect(periodButtons()[1].getAttribute('aria-pressed')).toBe('true');
      expect(text()).toContain('Compared with the 30 days before');
      expect(metricTile('messages_sent')).toContain('40');
    });
  });

  it('shows an encouraging empty state when no badge was unlocked', async () => {
    mockFetch.mockResolvedValue(okResponse(report({ badges_unlocked: [] })));

    await settle();

    expect(text()).toContain('No new badges in this period');
    expect(fixture.nativeElement.querySelector('ul[role="list"]')).toBeNull();
  });

  it('falls back to the server copy for a badge the dictionary does not know yet', async () => {
    mockFetch.mockResolvedValue(
      okResponse(
        report({
          badges_unlocked: [
            {
              code: 'brand_new_badge',
              name: 'Brand New Badge',
              description: 'Described by the server.',
              unlocked_at: '2026-11-08T09:00:00.000Z',
            },
          ],
        }),
      ),
    );

    await settle();

    expect(text()).toContain('Brand New Badge');
    expect(text()).toContain('Described by the server.');
    expect(text()).not.toContain('achievements.badge');
  });

  it('formats numbers for the interface language', async () => {
    TestBed.inject(I18nService).currentLang.set('fr');
    mockFetch.mockResolvedValue(okResponse(report()));

    await settle();

    expect(metricTile('study_hours')).toContain('2,5');
  });

  it('aborts the in-flight request when the period changes', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => undefined));
    fixture.detectChanges();
    const firstSignal: AbortSignal = mockFetch.mock.calls[0][1].signal;
    expect(firstSignal.aborted).toBe(false);

    mockFetch.mockResolvedValue(okResponse(report({ period: 'month' })));
    periodButtons()[1].click();
    await settle();

    expect(firstSignal.aborted).toBe(true);
  });

  it('shows an accessible loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Loading your report...',
    );
    expect(fixture.nativeElement.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it.each([
    ['a network failure', () => mockFetch.mockRejectedValue(new Error('offline'))],
    ['an unsuccessful response', () => mockFetch.mockResolvedValue({ ok: false, json: vi.fn() })],
  ])('shows a retryable error state after %s', async (_label, arrange) => {
    arrange();

    await settle();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Failed to load your report. Please try again.');
    expect(alert?.textContent).toContain('Retry');
    expect(fixture.nativeElement.querySelector('dl')).toBeNull();
  });

  it('retries after a transient failure and renders the confirmed report', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce(okResponse(report()));
    await settle();

    fixture.nativeElement.querySelector('[role="alert"] button').click();
    await settle();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(metricTile('messages_sent')).toContain('12');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    ['a report for a different period', report({ period: 'month' })],
    ['a missing metric', report({ metrics: metrics().slice(1) })],
    [
      'a duplicated metric',
      report({
        metrics: [...metrics().slice(1), { key: 'messages_sent', current: 1, previous: 1 }],
      }),
    ],
    [
      'an unknown metric',
      report({ metrics: [...metrics().slice(1), { key: 'coins', current: 1, previous: 1 }] }),
    ],
    [
      'a negative metric',
      report({
        metrics: metrics().map((m) => ({
          ...m,
          current: m.key === 'messages_sent' ? -1 : m.current,
        })),
      }),
    ],
    ['badges that are not a list', report({ badges_unlocked: 'many' })],
    [
      'a badge with an unreadable date',
      report({ badges_unlocked: [{ ...firstMomentBadge, unlocked_at: 'yesterday-ish' }] }),
    ],
    ['a negative streak', report({ streak_days: -2 })],
    ['a fractional streak', report({ streak_days: 1.5 })],
    ['a payload that is not an object', 'oops'],
  ])('rejects %s instead of rendering misleading figures', async (_label, payload) => {
    mockFetch.mockResolvedValue(okResponse(payload));

    await settle();

    expect(text()).toContain('Failed to load your report. Please try again.');
    expect(fixture.nativeElement.querySelector('dl')).toBeNull();
  });
});
