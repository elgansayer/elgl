import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../../services/i18n.service';
import {
  ProfileLanguageBadgesComponent,
  type ProfileLanguageKind,
} from './profile-language-badges.component';

describe('ProfileLanguageBadgesComponent', () => {
  const dictionary: Record<string, string> = {
    'profile.nativeLanguagesHeading': 'Native languages',
    'profile.targetLanguagesHeading': 'Learning languages',
    'profile.languagesNotSet': 'Not set yet',
  };

  let currentLang: WritableSignal<string>;

  function render(
    kind: ProfileLanguageKind,
    languages: readonly string[] | null | undefined,
  ): ComponentFixture<ProfileLanguageBadgesComponent> {
    const fixture = TestBed.createComponent(ProfileLanguageBadgesComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('languages', languages);
    fixture.detectChanges();
    return fixture;
  }

  function badgeTexts(fixture: ComponentFixture<ProfileLanguageBadgesComponent>): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('li')).map((item) =>
      Array.from(item.querySelectorAll(':scope > span'))
        .map((part) => (part.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' '),
    );
  }

  beforeEach(() => {
    currentLang = signal('en-GB');
    TestBed.configureTestingModule({
      imports: [ProfileLanguageBadgesComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            currentLang,
            translate: (key: string) => dictionary[key] ?? key,
          },
        },
      ],
    });
  });

  it('renders one badge per language with a flag and the language name', () => {
    const fixture = render('native', ['en', 'ja']);

    expect(badgeTexts(fixture)).toEqual(['🇬🇧 English', '🇯🇵 Japanese']);
  });

  it('hides the decorative flag from assistive technology', () => {
    const fixture = render('target', ['fr']);

    const flag: HTMLElement = fixture.nativeElement.querySelector('li span');
    expect(flag.textContent?.trim()).toBe('🇫🇷');
    expect(flag.getAttribute('aria-hidden')).toBe('true');
  });

  it('names languages in the interface language and follows a language change', () => {
    const fixture = render('target', ['en', 'es']);
    expect(badgeTexts(fixture)).toEqual(['🇬🇧 English', '🇪🇸 Spanish']);

    currentLang.set('fr');
    fixture.detectChanges();

    expect(badgeTexts(fixture)).toEqual(['🇬🇧 anglais', '🇪🇸 espagnol']);
  });

  it('resolves regional tags to their dialect name and the base language flag', () => {
    const fixture = render('native', ['en-GB', 'pt_BR']);

    const texts = badgeTexts(fixture);
    expect(texts[0]).toBe('🇬🇧 British English');
    expect(texts[1]).toContain('🇵🇹');
    expect(texts[1]).toContain('Brazilian Portuguese');
  });

  it('labels each group with its translated heading', () => {
    const native = render('native', ['en']);
    const target = render('target', ['fr']);

    for (const [fixture, heading] of [
      [native, 'Native languages'],
      [target, 'Learning languages'],
    ] as const) {
      const group: HTMLElement = fixture.nativeElement.querySelector('[role="group"]');
      const title: HTMLElement = fixture.nativeElement.querySelector('h3');
      expect(title.textContent?.trim()).toBe(heading);
      expect(title.id).not.toBe('');
      expect(group.getAttribute('aria-labelledby')).toBe(title.id);
    }
  });

  it('gives each instance its own heading id so several groups can share a page', () => {
    const native = render('native', ['en']);
    const target = render('target', ['fr']);

    expect(native.nativeElement.querySelector('h3').id).not.toBe(
      target.nativeElement.querySelector('h3').id,
    );
  });

  it('exposes the badges as a list', () => {
    const fixture = render('native', ['en', 'de']);

    const list: HTMLElement = fixture.nativeElement.querySelector('ul');
    expect(list.getAttribute('role')).toBe('list');
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });

  it.each([[null], [undefined], [[]]])('shows the not-set message for %s', (languages) => {
    const fixture = render('target', languages);

    expect(fixture.nativeElement.querySelector('ul')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Not set yet');
  });

  it('ignores blank entries and de-duplicates codes regardless of case or padding', () => {
    const fixture = render('native', ['en', ' EN ', '', '   ', 'fr']);

    expect(badgeTexts(fixture)).toEqual(['🇬🇧 English', '🇫🇷 French']);
  });

  it('skips entries that are not strings instead of failing the profile', () => {
    const untrusted: unknown = ['en', 42, null, { code: 'fr' }, 'de'];
    const fixture = render('native', Array.isArray(untrusted) ? untrusted : []);

    expect(badgeTexts(fixture)).toEqual(['🇬🇧 English', '🇩🇪 German']);
  });

  it('falls back to the upper-cased code for malformed tags without throwing', () => {
    const fixture = render('target', ['not a language!']);

    expect(badgeTexts(fixture)).toEqual(['🌍 NOT A LANGUAGE!']);
  });

  it('keeps rendering when the interface locale is not a valid language tag', () => {
    currentLang.set('not a locale!');

    const fixture = render('native', ['en']);

    expect(badgeTexts(fixture)).toEqual(['🇬🇧 EN']);
  });

  it('renders untrusted codes as inert text', () => {
    const fixture = render('native', ['<img src=x onerror=alert(1)>']);

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(badgeTexts(fixture)[0]).toContain('<IMG SRC=X ONERROR=ALERT(1)>');
  });

  it('wraps long names instead of overflowing and uses logical spacing only', () => {
    const fixture = render('native', ['en']);

    const badge: HTMLElement = fixture.nativeElement.querySelector('li');
    expect(badge.className).toContain('max-w-full');
    expect(badge.className).toContain('min-w-0');
    expect(badge.querySelector('.break-words')).not.toBeNull();
    expect(fixture.nativeElement.innerHTML).not.toMatch(/\b(?:pl|pr|ml|mr)-\d/);
  });

  it('distinguishes native from target badges by tone as well as by heading', () => {
    const native = render('native', ['en']);
    const target = render('target', ['en']);

    expect(native.nativeElement.querySelector('li').className).not.toBe(
      target.nativeElement.querySelector('li').className,
    );
  });
});
