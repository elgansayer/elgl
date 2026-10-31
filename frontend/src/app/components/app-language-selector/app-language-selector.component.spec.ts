import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, LanguageInfo } from '../../services/i18n.service';
import { UiLanguagePreferenceService } from '../../services/ui-language-preference.service';
import { AppLanguageSelectorComponent } from './app-language-selector.component';

describe('AppLanguageSelectorComponent', () => {
  const languages: readonly LanguageInfo[] = [
    {
      code: 'en-GB',
      name: 'British English',
      nativeName: 'English (UK)',
      flag: '🇬🇧',
      isRtl: false,
    },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
  ];

  let component: AppLanguageSelectorComponent;
  let fixture: ComponentFixture<AppLanguageSelectorComponent>;
  let currentLang = signal('en-GB');
  let changeLanguage: ReturnType<typeof vi.fn>;
  let legacySetLanguage: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement;
  const options = (): HTMLButtonElement[] =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('[role="dialog"] .grid button'));
  const optionFor = (name: string): HTMLButtonElement => {
    const match = options().find((option) => option.getAttribute('aria-label') === name);
    if (!match) throw new Error(`No language option named ${name}`);
    return match;
  };

  async function open(): Promise<void> {
    component.toggleModal();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    currentLang = signal('en-GB');
    changeLanguage = vi.fn().mockResolvedValue(undefined);
    legacySetLanguage = vi.fn();

    await TestBed.configureTestingModule({
      imports: [AppLanguageSelectorComponent],
      providers: [
        {
          provide: UiLanguagePreferenceService,
          useValue: { currentLang, availableLanguages: languages, changeLanguage },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang,
            translate: (key: string) => key,
            setLanguage: legacySetLanguage,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLanguageSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start closed', () => {
    expect(component.isOpen()).toBe(false);
    expect(root().querySelector('[role="dialog"]')).toBeNull();
  });

  it('should toggle modal', () => {
    component.toggleModal();
    expect(component.isOpen()).toBe(true);
    component.toggleModal();
    expect(component.isOpen()).toBe(false);
  });

  it('changes language through the preference boundary and closes on success', async () => {
    component.isOpen.set(true);

    await component.selectLanguage('es');

    expect(changeLanguage).toHaveBeenCalledTimes(1);
    expect(changeLanguage).toHaveBeenCalledWith('es');
    expect(component.isOpen()).toBe(false);
    expect(component.hasError()).toBe(false);
    expect(component.isChanging()).toBe(false);
  });

  it('never calls the legacy fail-open loader directly', async () => {
    await component.selectLanguage('es');

    expect(legacySetLanguage).not.toHaveBeenCalled();
  });

  it('keeps the modal open with an alert when the change is rejected, then allows a retry', async () => {
    changeLanguage.mockRejectedValueOnce(new Error('translation provider unavailable'));
    await open();

    optionFor('Spanish').click();
    await vi.waitFor(() => expect(component.isChanging()).toBe(false));
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.hasError()).toBe(true);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain(
      'languageSettings.loadError',
    );

    optionFor('Spanish').click();
    await vi.waitFor(() => expect(component.isOpen()).toBe(false));

    expect(changeLanguage).toHaveBeenCalledTimes(2);
    expect(component.hasError()).toBe(false);
  });

  it('clears a stale alert when the modal is closed and reopened', async () => {
    changeLanguage.mockRejectedValueOnce(new Error('unavailable'));
    await component.selectLanguage('ar');
    expect(component.hasError()).toBe(true);

    component.closeModal();
    component.toggleModal();

    expect(component.hasError()).toBe(false);
  });

  it('closes without reloading when the active language is chosen again', async () => {
    component.isOpen.set(true);

    await component.selectLanguage('en-GB');

    expect(changeLanguage).not.toHaveBeenCalled();
    expect(component.isOpen()).toBe(false);
  });

  it('ignores further selections and disables every option while a change is pending', async () => {
    let finish: (() => void) | undefined;
    changeLanguage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await open();

    const pending = component.selectLanguage('es');
    await component.selectLanguage('ar');
    fixture.detectChanges();

    expect(changeLanguage).toHaveBeenCalledTimes(1);
    expect(component.isChanging()).toBe(true);
    expect(options().every((option) => option.disabled)).toBe(true);
    expect(root().querySelector('[role="dialog"]')?.getAttribute('aria-busy')).toBe('true');

    finish?.();
    await pending;
    fixture.detectChanges();
    expect(component.isChanging()).toBe(false);
  });

  it('marks only the active language as current for assistive technology', async () => {
    await open();

    expect(optionFor('British English').getAttribute('aria-current')).toBe('true');
    expect(optionFor('Spanish').getAttribute('aria-current')).toBeNull();
    expect(optionFor('Arabic').getAttribute('aria-current')).toBeNull();
  });

  it('follows the active language when it changes elsewhere', async () => {
    await open();

    currentLang.set('ar');
    fixture.detectChanges();

    expect(optionFor('Arabic').getAttribute('aria-current')).toBe('true');
    expect(optionFor('British English').getAttribute('aria-current')).toBeNull();
  });
});
