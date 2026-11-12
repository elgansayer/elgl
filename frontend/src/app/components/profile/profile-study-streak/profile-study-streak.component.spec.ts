import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../../services/i18n.service';
import { ProfileStudyStreakComponent } from './profile-study-streak.component';

describe('ProfileStudyStreakComponent', () => {
  const dictionary: Record<string, string> = {
    'profile.studyStreakHeading': 'Study streak',
    'profile.studyStreakStart': 'Study today to start your streak.',
    'profile.studyStreakDays.one': '{{count}} day',
    'profile.studyStreakDays.other': '{{count}} days',
  };

  let currentLang: WritableSignal<string>;

  function render(days: number | null | undefined): ComponentFixture<ProfileStudyStreakComponent> {
    const fixture = TestBed.createComponent(ProfileStudyStreakComponent);
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
    return fixture;
  }

  function streakText(fixture: ComponentFixture<ProfileStudyStreakComponent>): string {
    const value: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="study-streak-value"]',
    );
    return (value.textContent ?? '').trim();
  }

  beforeEach(() => {
    currentLang = signal('en-GB');
    TestBed.configureTestingModule({
      imports: [ProfileStudyStreakComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            currentLang,
            translate: (key: string, params?: Record<string, unknown>) => {
              let text = dictionary[key] ?? key;
              for (const [name, value] of Object.entries(params ?? {})) {
                text = text.replace(`{{${name}}}`, String(value));
              }
              return text;
            },
          },
        },
      ],
    });
  });

  it('shows the streak as translated text with the heading', () => {
    const fixture = render(14);

    expect(fixture.nativeElement.querySelector('h3').textContent.trim()).toBe('Study streak');
    expect(streakText(fixture)).toBe('14 days');
  });

  it('uses the singular form for a one day streak', () => {
    expect(streakText(render(1))).toBe('1 day');
  });

  it('shows a zero streak as zero rather than inventing progress', () => {
    const fixture = render(0);

    expect(streakText(fixture)).toBe('0 days');
    expect(fixture.nativeElement.textContent).toContain('Study today to start your streak.');
  });

  it('hides the start prompt once a streak is running', () => {
    expect(render(3).nativeElement.textContent).not.toContain('Study today to start your streak.');
  });

  it.each([[null], [undefined], [-4], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'treats %s as no streak',
    (days) => {
      const fixture = render(days);

      expect(streakText(fixture)).toBe('0 days');
      expect(fixture.nativeElement.textContent).toContain('Study today to start your streak.');
    },
  );

  it('rounds a fractional value down to whole days', () => {
    expect(streakText(render(6.9))).toBe('6 days');
  });

  it('groups large streaks using the interface locale', () => {
    expect(streakText(render(1234))).toBe(`${new Intl.NumberFormat('en-GB').format(1234)} days`);
  });

  it('formats digits and follows the interface language when it changes', () => {
    const fixture = render(47);
    expect(streakText(fixture)).toBe('47 days');

    currentLang.set('ar');
    fixture.detectChanges();

    expect(streakText(fixture)).toBe(`${new Intl.NumberFormat('ar').format(47)} days`);
  });

  it('falls back to the other form for plural categories the dictionary does not define', () => {
    currentLang.set('ar');

    // Arabic distinguishes "two" from "other"; only "one" and "other" are authored today.
    expect(new Intl.PluralRules('ar').select(2)).toBe('two');
    expect(streakText(render(2))).toBe(`${new Intl.NumberFormat('ar').format(2)} days`);
  });

  it('keeps rendering when the interface locale is not a valid language tag', () => {
    currentLang.set('not a locale!');

    expect(streakText(render(5))).toBe('5 days');
  });

  it('keeps the decorative flame out of the accessibility tree', () => {
    const icon: HTMLElement = render(5).nativeElement.querySelector('ng-icon');

    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels the group with its heading', () => {
    const fixture = render(5);

    const group: HTMLElement = fixture.nativeElement.querySelector('[role="group"]');
    const title: HTMLElement = fixture.nativeElement.querySelector('h3');
    expect(title.id).not.toBe('');
    expect(group.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('does not rely on colour alone: the state is spelled out in text for every value', () => {
    for (const days of [0, 1, 9]) {
      expect(streakText(render(days))).toMatch(/\d+ days?/);
    }
  });

  it('uses semantic Relay classes and logical spacing only', () => {
    const fixture = render(5);
    const html: string = fixture.nativeElement.innerHTML;
    const icon: HTMLElement = fixture.nativeElement.querySelector('ng-icon');

    expect(icon.className).toContain('text-primary-ink');
    expect(icon.className).not.toContain('text-neon-orange');
    expect(html).not.toMatch(/\b(?:pl|pr|ml|mr)-\d/);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
