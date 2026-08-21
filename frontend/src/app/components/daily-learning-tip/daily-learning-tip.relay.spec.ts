import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { DailyLearningTipComponent } from './daily-learning-tip.component';

describe('DailyLearningTipComponent Relay contract', () => {
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
    mockFetch.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tip: 'Practise a little every day.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [DailyLearningTipComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DailyLearningTipComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Relay semantic surface and text roles without feature-owned product colours', () => {
    const root = fixture.nativeElement as HTMLElement;
    const card = root.querySelector('app-card');
    const heading = root.querySelector('h2');
    const tip = root.querySelector('p');

    expect(card).not.toBeNull();
    expect(card?.className).toContain('rounded-card');
    expect(card?.className).toContain('bg-surface-200');
    expect(card?.className).toContain('border-surface-100');
    expect(card?.className).toContain('shadow-card');
    expect(heading?.className).toContain('text-text-muted');
    expect(tip?.className).toContain('text-text-primary');

    expect(root.innerHTML).not.toMatch(/(?:text-white|text-black|bg-white|bg-black|#[0-9a-f]{3,8})/i);
  });

  it('keeps sizing host-controlled and uses direction-neutral spacing for responsive reflow', () => {
    const card = (fixture.nativeElement as HTMLElement).querySelector('app-card');
    const classes = card?.className ?? '';

    expect(classes).toContain('block');
    expect(classes).toContain('ps-4');
    expect(classes).toContain('pe-4');
    expect(classes).toContain('pt-4');
    expect(classes).toContain('pb-4');
    expect(classes).not.toMatch(/\b(?:w|max-w|min-w|h|max-h|min-h)-/);
    expect(classes).not.toMatch(/\b(?:ml|mr|pl|pr)-/);
  });

  it('does not fork light and dark presentation in feature classes', () => {
    const root = fixture.nativeElement as HTMLElement;
    const featureClasses = [
      root.querySelector('h2')?.className ?? '',
      root.querySelector('p')?.className ?? '',
    ].join(' ');

    expect(featureClasses).not.toContain('dark:');
    expect(featureClasses).toContain('text-text-muted');
    expect(featureClasses).toContain('text-text-primary');
  });
});
