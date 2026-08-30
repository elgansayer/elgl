import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DailyLearningTipComponent } from './daily-learning-tip.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

describe('DailyLearningTipComponent', () => {
  let fixture: ComponentFixture<DailyLearningTipComponent>;
  const mockFetch = vi.fn();

  const mockAuthService = {
    getAccessToken: vi.fn(),
  };

  const mockI18nService = {
    translate: vi.fn((key: string) => key),
  };

  beforeEach(async () => {
    mockAuthService.getAccessToken.mockReset().mockReturnValue('mock-access-token');
    mockI18nService.translate.mockClear();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [DailyLearningTipComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(DailyLearningTipComponent);
    fixture.detectChanges();
  }

  async function settleComponent(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should create', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tip: 'Practise daily.' }),
    });

    createComponent();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sends the bearer token from AuthService when fetching the tip', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tip: 'Practise daily.' }),
    });

    createComponent();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/daily-tip', {
      headers: { Authorization: 'Bearer mock-access-token' },
    });
  });

  it('names the Relay region and exposes its loading state without adding focus targets', () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));

    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const card = compiled.querySelector('app-card');

    expect(card?.getAttribute('role')).toBe('region');
    expect(card?.getAttribute('aria-label')).toBe('home.dailyTip.title');
    expect(card?.getAttribute('aria-busy')).toBe('true');
    expect(
      compiled.querySelectorAll('button, a[href], input, select, textarea, [tabindex]').length,
    ).toBe(0);
  });

  it('renders the fetched tip once loaded and clears the busy state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tip: 'Practise daily.' }),
    });

    createComponent();
    await settleComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Practise daily.');
    expect(compiled.querySelector('app-card')?.getAttribute('aria-busy')).toBeNull();
  });

  it('keeps long content reflowable at high zoom without physical-direction utilities', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tip: 'averylongunbrokentipthatmustremainreadableat400percentzoom' }),
    });

    createComponent();
    await settleComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const card = compiled.querySelector('app-card');
    const tip = compiled.querySelector('p.text-base');

    expect(card?.className).toContain('min-w-0');
    expect(card?.className).toContain('motion-reduce:transition-none');
    expect(tip?.className).toContain('break-words');
    expect(tip?.className).toContain('[overflow-wrap:anywhere]');
    expect(compiled.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-/);
  });

  it('falls back to the default tip when the request fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    createComponent();
    await settleComponent();

    expect(fixture.nativeElement.textContent).toContain('home.dailyTip.fallback');
  });

  it('falls back without making a request when no access token is available', async () => {
    mockAuthService.getAccessToken.mockReturnValue(null);

    createComponent();
    await settleComponent();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('home.dailyTip.fallback');
  });

  it('falls back when the endpoint returns no tip', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    createComponent();
    await settleComponent();

    expect(fixture.nativeElement.textContent).toContain('home.dailyTip.fallback');
  });

  it('keeps the Relay card non-interactive because the surface has no controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tip: 'Practise daily.' }),
    });

    createComponent();
    await settleComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const card = compiled.querySelector('app-card');

    expect(card).not.toBeNull();
    expect(card?.getAttribute('role')).toBe('region');
    expect(card?.getAttribute('tabindex')).toBeNull();
    expect(
      compiled.querySelector('button, a[href], input, select, textarea, [role="button"]'),
    ).toBeNull();
  });
});
