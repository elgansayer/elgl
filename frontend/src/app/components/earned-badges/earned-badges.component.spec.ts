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

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show VIP badge when user has VIP status', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: false });
    fixture.detectChanges();

    const vipBadge = Array.from(fixture.nativeElement.querySelectorAll('span')).find((span) =>
      (span as HTMLElement).textContent?.includes('👑'),
    );

    expect(vipBadge).toBeTruthy();
  });

  it('should show serious learner badge when user is a serious learner', () => {
    badgesSignal.set({ isVip: false, isSeriousLearner: true });
    fixture.detectChanges();

    const seriousBadge = Array.from(fixture.nativeElement.querySelectorAll('span')).find((span) =>
      (span as HTMLElement).textContent?.includes('🎓'),
    );

    expect(seriousBadge).toBeTruthy();
  });

  it('should show both badges when both flags are true', () => {
    badgesSignal.set({ isVip: true, isSeriousLearner: true });
    fixture.detectChanges();

    const spans = Array.from(fixture.nativeElement.querySelectorAll('span'));

    const hasVip = spans.some((span) => (span as HTMLElement).textContent?.includes('👑'));
    const hasSerious = spans.some((span) => (span as HTMLElement).textContent?.includes('🎓'));

    expect(hasVip).toBe(true);
    expect(hasSerious).toBe(true);
  });

  it('should show the none message when neither flag is true', () => {
    badgesSignal.set({ isVip: false, isSeriousLearner: false });
    fixture.detectChanges();

    const noneBadge = fixture.nativeElement.querySelector('span.text-xs.text-text-muted');
    expect(noneBadge).toBeTruthy();
    expect((noneBadge as HTMLElement).textContent?.trim()).toBe('badges.none');
  });
});
