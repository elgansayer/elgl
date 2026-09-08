import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';

import { EarnedBadgesComponent } from './earned-badges.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

interface BadgeState {
  isVip: boolean;
  isSeriousLearner: boolean;
}

describe('EarnedBadgesComponent', () => {
  let component: EarnedBadgesComponent;
  let fixture: ComponentFixture<EarnedBadgesComponent>;
  let badgesSignal: WritableSignal<BadgeState>;

  const mockI18n: Pick<I18nService, 'translate'> = {
    translate: (key: string): string => key,
  };

  beforeEach(async () => {
    badgesSignal = signal<BadgeState>({ isVip: false, isSeriousLearner: false });

    await TestBed.configureTestingModule({
      imports: [EarnedBadgesComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            earnedBadges: (): BadgeState => badgesSignal(),
          },
        },
        {
          provide: I18nService,
          useValue: mockI18n,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EarnedBadgesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function pillContaining(text: string): HTMLElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('app-pill > span')).find((element) =>
      (element as HTMLElement).textContent?.includes(text),
    ) as HTMLElement | undefined;
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show VIP badge when user has VIP status', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: false });
    fixture.detectChanges();

    expect(pillContaining('badges.vip')).toBeTruthy();
  });

  it('should show serious learner badge when user is a serious learner', () => {
    badgesSignal.set({ isVip: false, isSeriousLearner: true });
    fixture.detectChanges();

    expect(pillContaining('badges.seriousLearner')).toBeTruthy();
  });

  it('should show both badges when both flags are true', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: true });
    fixture.detectChanges();

    expect(pillContaining('badges.vip')).toBeTruthy();
    expect(pillContaining('badges.seriousLearner')).toBeTruthy();
  });

  it('should show the none message when neither flag is true', () => {
    badgesSignal.set({ isVip: false, isSeriousLearner: false });
    fixture.detectChanges();

    const noneBadge = fixture.nativeElement.querySelector('span.text-xs.text-text-muted');
    expect(noneBadge).toBeTruthy();
    expect((noneBadge as HTMLElement).textContent?.trim()).toBe('badges.none');
  });

  it('uses the Relay VIP gold role instead of the old feature-owned gradient', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: false });
    fixture.detectChanges();

    const vipBadge = pillContaining('badges.vip');
    expect(vipBadge).toBeTruthy();
    expect(vipBadge?.classList.contains('bg-vip')).toBe(true);
    expect(vipBadge?.classList.contains('text-on-fill')).toBe(true);
    expect(vipBadge?.classList.contains('rounded-pill')).toBe(true);
    expect(vipBadge?.classList.contains('bg-gradient-to-r')).toBe(false);
    expect(vipBadge?.classList.contains('from-vip')).toBe(false);
    expect(vipBadge?.classList.contains('to-accent')).toBe(false);
  });

  it('uses the per-user primary role for the learner status instead of mixed semantic gradients', () => {
    badgesSignal.set({ isVip: false, isSeriousLearner: true });
    fixture.detectChanges();

    const seriousBadge = pillContaining('badges.seriousLearner');
    expect(seriousBadge).toBeTruthy();
    expect(seriousBadge?.classList.contains('bg-primary')).toBe(true);
    expect(seriousBadge?.classList.contains('text-on-fill')).toBe(true);
    expect(seriousBadge?.classList.contains('bg-gradient-to-r')).toBe(false);
    expect(seriousBadge?.classList.contains('from-secondary')).toBe(false);
    expect(seriousBadge?.classList.contains('to-success')).toBe(false);
  });

  it('keeps the badge group and individual pills bounded and wrap-safe at narrow widths', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: true });
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('div') as HTMLElement;
    const pills = Array.from(fixture.nativeElement.querySelectorAll('app-pill > span')) as HTMLElement[];

    expect(group.classList.contains('flex-wrap')).toBe(true);
    expect(group.classList.contains('min-w-0')).toBe(true);
    expect(group.classList.contains('max-w-full')).toBe(true);
    expect(pills).toHaveLength(2);
    for (const pill of pills) {
      expect(pill.classList.contains('max-w-full')).toBe(true);
      expect(pill.classList.contains('whitespace-normal')).toBe(true);
      expect(pill.classList.contains('break-words')).toBe(true);
    }
  });

  it('marks badge emoji as decorative while keeping translated status text visible', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: true });
    fixture.detectChanges();

    const decorativeEmoji = Array.from(
      fixture.nativeElement.querySelectorAll('[aria-hidden="true"]'),
    ) as HTMLElement[];
    expect(decorativeEmoji.map((element) => element.textContent?.trim())).toEqual(['👑', '🎓']);
    expect(fixture.nativeElement.textContent).toContain('badges.vip');
    expect(fixture.nativeElement.textContent).toContain('badges.seriousLearner');
  });

  it('keeps earned statuses read-only without native or synthetic interactive semantics', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: true });
    fixture.detectChanges();

    const interactiveSelector = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[tabindex]',
      '[aria-pressed]',
    ].join(',');

    expect(fixture.nativeElement.querySelectorAll(interactiveSelector)).toHaveLength(0);
  });
});
