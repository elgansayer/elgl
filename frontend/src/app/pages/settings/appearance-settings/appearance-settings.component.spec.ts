import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter } from '@angular/router';
import { signal, Pipe, PipeTransform } from '@angular/core';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { I18nService } from '../../../services/i18n.service';
import { FontScaleService } from '../../../services/font-scale.service';
import { ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';
import { ChatSettingsService } from '../../../services/chat-settings.service';
import { TranslatePipe } from '../../../services/translate.pipe';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

describe('AppearanceSettingsComponent', () => {
  let component: AppearanceSettingsComponent;
  let fixture: ComponentFixture<AppearanceSettingsComponent>;
  let i18nServiceMock: Partial<I18nService>;
  let themeServiceMock: Partial<ThemeService>;
  let fontScaleServiceMock: Partial<FontScaleService>;
  let userServiceMock: Partial<UserService>;
  let chatSettingsServiceMock: Partial<ChatSettingsService>;
  let locationMock: Partial<Location>;
  const textSizePreference = signal<'small' | 'normal' | 'large'>('normal');
  const chatTextSize = signal<'small' | 'medium' | 'large'>('medium');

  beforeEach(async () => {
    textSizePreference.set('normal');
    chatTextSize.set('medium');

    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
      availableLanguages: [
        { code: 'en-GB', flag: '🇬🇧', nativeName: 'English', name: 'English', isRtl: false },
        { code: 'es', flag: '🇪🇸', nativeName: 'Español', name: 'Spanish', isRtl: false },
      ],
    };

    themeServiceMock = {
      currentTheme: signal<'light' | 'dark' | 'system'>('system'),
      setTheme: vi.fn(),
      setPrimaryAccentColor: vi.fn(),
      resetPrimaryAccentColor: vi.fn(),
      primaryAccentColor: signal('#4f46e5'),
      loadFromProfile: vi.fn(),
    };

    fontScaleServiceMock = {
      scaleFactor: signal(1.0),
      textSizePreference,
      chatTextSize,
      setScale: vi.fn(),
      setTextSizePreference: vi.fn((value: 'small' | 'normal' | 'large') =>
        textSizePreference.set(value),
      ),
      setChatTextSize: vi.fn((value: 'small' | 'medium' | 'large') => chatTextSize.set(value)),
      min: 0.8,
      max: 1.5,
      step: 0.05,
    };

    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({
        id: '1',
        is_vip: true,
        primary_accent_color: '#4f46e5',
        native_languages: [],
        target_languages: [],
        coins_balance: 0,
        study_streak_days: 0,
        correction_ratio: 0,
        is_serious_learner: false,
        privacy_hide_age: false,
        privacy_hide_location: false,
        privacy_hide_gender: false,
        privacy_hide_from_search: false,
        is_admin: false,
        vip_tier: '',
        created_at: '',
      }),
      updateMyProfile: vi.fn().mockResolvedValue({}),
    };

    chatSettingsServiceMock = {
      textSize: signal<'small' | 'medium' | 'large'>('medium'),
      loadSettings: vi.fn().mockResolvedValue(true),
      updateSetting: vi.fn().mockResolvedValue(true),
    };

    locationMock = {
      back: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppearanceSettingsComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: ChatSettingsService, useValue: chatSettingsServiceMock },
        { provide: Location, useValue: locationMock },
      ],
    })
      .overrideComponent(AppearanceSettingsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    await recreate();
  });

  /** Builds a fresh page, so a test can change how the stores respond first. */
  async function recreate(): Promise<void> {
    fixture = TestBed.createComponent(AppearanceSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const query = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);
  const queryAll = (selector: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));
  const swatches = (): HTMLButtonElement[] =>
    queryAll('button[aria-label="settings.selectAccentColour"]').filter(
      (element): element is HTMLButtonElement => element instanceof HTMLButtonElement,
    );

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set the theme', () => {
    component.setTheme('dark');
    expect(themeServiceMock.setTheme).toHaveBeenCalledWith('dark');
  });

  it('should expose all supported theme choices', () => {
    expect(component.themeOptions).toEqual(['light', 'dark', 'system']);
  });

  it('should render font scale percent label', () => {
    fontScaleServiceMock.scaleFactor?.set(1.1);
    fixture.detectChanges();
    expect(component.fontScalePercentLabel()).toBe('110%');
  });

  it('should set the app text size independently', () => {
    component.setTextSize('large');
    expect(fontScaleServiceMock.setTextSizePreference).toHaveBeenCalledWith('large');
    expect(component.currentTextSize()).toBe('large');
    expect(component.currentChatTextSize()).toBe('medium');
  });

  it('should set the chat text size independently', () => {
    component.setChatTextSize('small');
    expect(fontScaleServiceMock.setChatTextSize).toHaveBeenCalledWith('small');
    expect(component.currentChatTextSize()).toBe('small');
    expect(component.currentTextSize()).toBe('normal');
  });

  it('should synchronise a server chat text preference without changing app text size', () => {
    expect(chatSettingsServiceMock.loadSettings).toHaveBeenCalledOnce();
    expect(fontScaleServiceMock.setChatTextSize).toHaveBeenCalledWith('medium');
    expect(component.currentTextSize()).toBe('normal');
  });

  it('should navigate back', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  describe('interface language', () => {
    const languageLink = (): HTMLAnchorElement | null =>
      fixture.nativeElement.querySelector('a[href="/settings/language"]');

    it('links to the dedicated language settings page instead of switching inline', () => {
      expect(languageLink()).toBeTruthy();
      expect(fixture.nativeElement.querySelector('select')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-select')).toBeNull();
    });

    it('reflects the active interface language in the link row', () => {
      expect(languageLink()?.textContent).toContain('settings.languageSelectLabel');
      expect(languageLink()?.textContent).toContain('English');

      i18nServiceMock.currentLang?.set('es');
      fixture.detectChanges();

      expect(component.currentLanguage().code).toBe('es');
      expect(languageLink()?.textContent).toContain('Español');
    });

    it('falls back to the raw code for a locale outside the catalogue', () => {
      i18nServiceMock.currentLang?.set('xx');
      fixture.detectChanges();

      expect(component.currentLanguage()).toMatchObject({ code: 'xx', nativeName: 'xx' });
      expect(languageLink()?.textContent).toContain('xx');
    });

    it('hides the decorative flag and arrow from assistive technology and mirrors the arrow in RTL', () => {
      const hidden = Array.from(languageLink()?.querySelectorAll('[aria-hidden="true"]') ?? []);

      expect(hidden).toHaveLength(2);
      expect(hidden[1].classList.contains('rtl:rotate-180')).toBe(true);
    });

    it('never calls the legacy fail-open loader from this page', () => {
      expect(i18nServiceMock.setLanguage).not.toHaveBeenCalled();
    });
  });

  it('should set accent colour when VIP', () => {
    component.isVip.set(true);
    component.setAccentColor('#e11d48');
    expect(component.primaryAccentColor()).toBe('#e11d48');
  });

  it('should not set accent colour when not VIP', () => {
    component.isVip.set(false);
    component.setAccentColor('#e11d48');
    expect(component.primaryAccentColor()).toBe('#4f46e5');
  });

  it('should load the profile accent through the theme service entitlement boundary', () => {
    expect(themeServiceMock.loadFromProfile).toHaveBeenCalledWith({
      primary_accent_color: '#4f46e5',
    });
  });

  it('should persist chat text size and update the accent on VIP save', async () => {
    component.setChatTextSize('large');
    component.primaryAccentColor.set('#e11d48');

    await component.saveSettings();

    expect(userServiceMock.updateMyProfile).toHaveBeenCalledWith({
      primary_accent_color: '#e11d48',
    });
    expect(chatSettingsServiceMock.updateSetting).toHaveBeenCalledWith('textSize', 'large');
    expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#e11d48');
    expect(component.successMessage()).toBe('settings.saved');
    expect(component.errorMessage()).toBe('');
  });

  it('should not resubmit or apply a stored accent after VIP entitlement is lost', async () => {
    component.isVip.set(false);
    component.primaryAccentColor.set('#e11d48');

    await component.saveSettings();

    // No profile write at all: an empty PATCH would only add a way to fail.
    expect(userServiceMock.updateMyProfile).not.toHaveBeenCalled();
    expect(themeServiceMock.setPrimaryAccentColor).not.toHaveBeenCalledWith('#e11d48');
    expect(themeServiceMock.resetPrimaryAccentColor).toHaveBeenCalledOnce();
    expect(component.successMessage()).toBe('settings.saved');
  });

  it('should restore the server chat size and expose a retryable error when persistence fails', async () => {
    component.setChatTextSize('large');
    chatSettingsServiceMock.textSize?.set('medium');
    vi.mocked(chatSettingsServiceMock.updateSetting!).mockResolvedValueOnce(false);

    await component.saveSettings();

    expect(fontScaleServiceMock.setChatTextSize).toHaveBeenLastCalledWith('medium');
    expect(component.currentChatTextSize()).toBe('medium');
    expect(component.errorMessage()).toBe('settings.appearanceSaveError');
    expect(component.successMessage()).toBe('');
    expect(component.isSaving()).toBe(false);
  });

  it('should set custom colour from color input when VIP', () => {
    component.isVip.set(true);
    const input = document.createElement('input');
    input.value = '#ff6b6b';
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#ff6b6b');
  });

  it('should set custom colour from text input when VIP', () => {
    component.isVip.set(true);
    const input = document.createElement('input');
    input.value = '#c0ffee';
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#c0ffee');
  });

  it('should not set custom colour when not VIP', () => {
    component.isVip.set(false);
    component.primaryAccentColor.set('#4f46e5');
    const input = document.createElement('input');
    input.value = '#badbad';
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#4f46e5');
  });

  const inputField = (selector: string): HTMLInputElement => {
    const element = query(selector);
    if (!(element instanceof HTMLInputElement)) throw new Error(`Missing input ${selector}`);
    return element;
  };
  const saveButton = (): HTMLButtonElement => {
    const element = query('app-button-primary button');
    if (!(element instanceof HTMLButtonElement)) throw new Error('Missing save button');
    return element;
  };
  const chatSizeButtons = (): HTMLButtonElement[] =>
    queryAll('section[aria-labelledby="appearance-chat-size-heading"] button').filter(
      (element): element is HTMLButtonElement => element instanceof HTMLButtonElement,
    );

  describe('saving only what changed', () => {
    it('confirms without any write when nothing differs from the stored values', async () => {
      await component.saveSettings();

      expect(userServiceMock.updateMyProfile).not.toHaveBeenCalled();
      expect(chatSettingsServiceMock.updateSetting).not.toHaveBeenCalled();
      expect(component.successMessage()).toBe('settings.saved');
    });

    it('writes only the chat text size when the accent is unchanged', async () => {
      component.setChatTextSize('small');

      await component.saveSettings();

      expect(userServiceMock.updateMyProfile).not.toHaveBeenCalled();
      expect(chatSettingsServiceMock.updateSetting).toHaveBeenCalledExactlyOnceWith(
        'textSize',
        'small',
      );
    });

    it('writes the accent once and does not repeat it on a second save', async () => {
      component.setAccentColor('#C65230');

      await component.saveSettings();
      await component.saveSettings();

      expect(userServiceMock.updateMyProfile).toHaveBeenCalledExactlyOnceWith({
        primary_accent_color: '#C65230',
      });
      expect(chatSettingsServiceMock.updateSetting).not.toHaveBeenCalled();
      expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#C65230');
    });

    it('ignores a second save while one is still in flight', async () => {
      let release: () => void = () => undefined;
      vi.mocked(userServiceMock.updateMyProfile!).mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve({} as never);
        }),
      );
      component.setAccentColor('#C65230');

      const first = component.saveSettings();
      expect(component.isSaving()).toBe(true);
      await component.saveSettings();
      release();
      await first;

      expect(userServiceMock.updateMyProfile).toHaveBeenCalledTimes(1);
      expect(component.isSaving()).toBe(false);
      expect(component.successMessage()).toBe('settings.saved');
    });
  });

  describe('partial save failures', () => {
    it('never reports a rejected accent write as saved, and still saves the chat size', async () => {
      vi.mocked(userServiceMock.updateMyProfile!).mockRejectedValueOnce(new Error('403'));
      component.setAccentColor('#C65230');
      component.setChatTextSize('large');

      await component.saveSettings();

      expect(themeServiceMock.setPrimaryAccentColor).not.toHaveBeenCalled();
      expect(chatSettingsServiceMock.updateSetting).toHaveBeenCalledWith('textSize', 'large');
      expect(component.errorMessage()).toBe('settings.appearanceSaveError');
      expect(component.successMessage()).toBe('');
    });

    it('repeats only the unsaved accent on retry', async () => {
      vi.mocked(userServiceMock.updateMyProfile!).mockRejectedValueOnce(new Error('503'));
      component.setAccentColor('#C65230');
      component.setChatTextSize('large');
      await component.saveSettings();
      // The real service records the confirmed value; the mock does not.
      chatSettingsServiceMock.textSize?.set('large');
      vi.mocked(chatSettingsServiceMock.updateSetting!).mockClear();

      await component.saveSettings();

      expect(userServiceMock.updateMyProfile).toHaveBeenCalledTimes(2);
      expect(chatSettingsServiceMock.updateSetting).not.toHaveBeenCalled();
      expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#C65230');
      expect(component.errorMessage()).toBe('');
      expect(component.successMessage()).toBe('settings.saved');
    });

    it('keeps a saved accent applied when only the chat text size fails', async () => {
      vi.mocked(chatSettingsServiceMock.updateSetting!).mockResolvedValueOnce(false);
      component.setAccentColor('#C65230');
      component.setChatTextSize('large');

      await component.saveSettings();

      expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#C65230');
      expect(component.errorMessage()).toBe('settings.appearanceSaveError');
      expect(component.successMessage()).toBe('');
    });

    it('treats an unexpected rejection as a failed save and clears the busy state', async () => {
      vi.mocked(chatSettingsServiceMock.updateSetting!).mockRejectedValueOnce(new Error('boom'));
      component.setChatTextSize('large');

      await component.saveSettings();

      expect(component.errorMessage()).toBe('settings.appearanceSaveError');
      expect(component.successMessage()).toBe('');
      expect(component.isSaving()).toBe(false);
    });
  });

  describe('custom accent validation', () => {
    it.each(['#c65', 'c65230', '#gggggg', '', '#c652300', 'red'])(
      'flags %j as an accent the backend would reject',
      (value) => {
        component.primaryAccentColor.set(value);

        expect(component.accentInvalid()).toBe(true);
      },
    );

    it.each(['#c65230', '#C65230', '#AbCdEf'])('accepts the six-digit colour %s', (value) => {
      component.primaryAccentColor.set(value);

      expect(component.accentInvalid()).toBe(false);
    });

    it('treats having no custom accent as valid', () => {
      component.primaryAccentColor.set(null);

      expect(component.accentInvalid()).toBe(false);
    });

    it('blocks saving a half-typed colour and says why, then recovers once it is complete', async () => {
      const field = inputField('#customAccentHex');
      field.value = '#c65';
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby')).toBe('appearance-accent-error');
      expect(query('#appearance-accent-error')?.textContent).toContain(
        'settings.accentColourInvalid',
      );
      expect(saveButton().disabled).toBe(true);

      await component.saveSettings();
      expect(userServiceMock.updateMyProfile).not.toHaveBeenCalled();
      expect(chatSettingsServiceMock.updateSetting).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('settings.accentColourInvalid');

      field.value = '#c65230';
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(query('#appearance-accent-error')).toBeNull();
      expect(field.getAttribute('aria-invalid')).toBe('false');
      expect(field.hasAttribute('aria-describedby')).toBe(false);
      expect(saveButton().disabled).toBe(false);
    });

    it('trims whitespace around a pasted colour', () => {
      const field = inputField('#customAccentHex');
      field.value = ' #c65230 ';
      field.dispatchEvent(new Event('input'));

      expect(component.primaryAccentColor()).toBe('#c65230');
      expect(component.accentInvalid()).toBe(false);
    });

    it('keeps the native picker on a complete colour while the field is half typed', () => {
      component.primaryAccentColor.set('#c6');
      fixture.detectChanges();

      expect(component.accentPickerValue()).toBe('#c65230');
      expect(inputField('#customAccentColour').value).toBe('#c65230');
      expect(inputField('#customAccentHex').value).toBe('#c6');
    });
  });

  describe('unavailable stored settings', () => {
    it('reports an unreadable profile, keeps accent editing off and offers a retry', async () => {
      vi.mocked(userServiceMock.getMyProfile!).mockResolvedValue(null);
      await recreate();

      expect(component.profileAvailable()).toBe(false);
      expect(component.chatSettingsAvailable()).toBe(true);
      expect(component.loadFailed()).toBe(true);
      expect(component.isVip()).toBe(false);
      expect(query('[role="alert"]')?.textContent).toContain('settings.appearanceLoadError');
      expect(query('#appearance-retry')).not.toBeNull();
      expect(swatches()).toHaveLength(6);
      expect(swatches().every((button) => button.disabled)).toBe(true);
      expect(saveButton().disabled).toBe(true);
      // An unknown entitlement must not be presented as "VIP required".
      expect(fixture.nativeElement.textContent).not.toContain('settings.vipRequired');
    });

    it('treats a rejected profile request the same way', async () => {
      vi.mocked(userServiceMock.getMyProfile!).mockRejectedValue(new Error('offline'));
      await recreate();

      expect(component.profileAvailable()).toBe(false);
      expect(component.errorMessage()).toBe('settings.appearanceLoadError');
    });

    it('treats a rejected chat settings request as unavailable', async () => {
      vi.mocked(chatSettingsServiceMock.loadSettings!).mockRejectedValue(new Error('offline'));
      await recreate();

      expect(component.chatSettingsAvailable()).toBe(false);
      expect(component.loadFailed()).toBe(true);
    });

    it('locks chat text size and saving when chat settings cannot be read, then recovers on retry', async () => {
      vi.mocked(chatSettingsServiceMock.loadSettings!).mockResolvedValue(false);
      // The page built in beforeEach already applied the stored size to this shared mock.
      vi.mocked(fontScaleServiceMock.setChatTextSize!).mockClear();
      await recreate();

      expect(component.chatSettingsAvailable()).toBe(false);
      expect(component.errorMessage()).toBe('settings.appearanceLoadError');
      expect(chatSizeButtons()).toHaveLength(3);
      expect(chatSizeButtons().every((button) => button.disabled)).toBe(true);
      expect(saveButton().disabled).toBe(true);
      // An accent could not be committed either, so it must not be editable.
      expect(swatches().every((button) => button.disabled)).toBe(true);
      expect(query('#customAccentColour')).toBeNull();

      component.setChatTextSize('large');
      await component.saveSettings();
      expect(fontScaleServiceMock.setChatTextSize).not.toHaveBeenCalled();
      expect(userServiceMock.updateMyProfile).not.toHaveBeenCalled();
      expect(chatSettingsServiceMock.updateSetting).not.toHaveBeenCalled();

      vi.mocked(chatSettingsServiceMock.loadSettings!).mockResolvedValue(true);
      query('#appearance-retry')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.loadFailed()).toBe(false);
      expect(component.errorMessage()).toBe('');
      expect(query('#appearance-retry')).toBeNull();
      expect(chatSizeButtons().every((button) => !button.disabled)).toBe(true);
      expect(swatches().every((button) => !button.disabled)).toBe(true);
      expect(saveButton().disabled).toBe(false);
    });

    it('still lets theme and app text size work on this device when the account is unreachable', async () => {
      vi.mocked(userServiceMock.getMyProfile!).mockResolvedValue(null);
      vi.mocked(chatSettingsServiceMock.loadSettings!).mockResolvedValue(false);
      await recreate();

      component.setTheme('dark');
      component.setTextSize('large');

      expect(themeServiceMock.setTheme).toHaveBeenCalledWith('dark');
      expect(fontScaleServiceMock.setTextSizePreference).toHaveBeenCalledWith('large');
    });

    it('shows the VIP badge only for a loaded profile without the entitlement', async () => {
      expect(fixture.nativeElement.textContent).not.toContain('settings.vipRequired');

      vi.mocked(userServiceMock.getMyProfile!).mockResolvedValue({
        id: '2',
        is_vip: false,
      } as never);
      await recreate();

      expect(component.isVip()).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('settings.vipRequired');
      expect(swatches().every((button) => button.disabled)).toBe(true);
      expect(query('#customAccentColour')).toBeNull();
    });
  });

  describe('rendering and accessibility', () => {
    it('marks the saved accent as selected regardless of letter case, without relying on colour alone', () => {
      component.primaryAccentColor.set('#c65230');
      fixture.detectChanges();

      const pressed = swatches().filter((button) => button.getAttribute('aria-pressed') === 'true');
      expect(pressed).toHaveLength(1);
      expect(pressed[0].style.backgroundColor).toBe('rgb(198, 82, 48)');
      // Border thickness-independent cues: a larger swatch and a theme-aware outline.
      expect(pressed[0].classList.contains('scale-110')).toBe(true);
      expect(pressed[0].classList.contains('border-text-primary')).toBe(true);
    });

    it('offers six named accent swatches with a touch-sized target', () => {
      expect(component.accentOptions.map((option) => option.nameKey)).toEqual([
        'settings.accentEmber',
        'settings.accentTide',
        'settings.accentGold',
        'settings.accentRaspberry',
        'settings.accentViolet',
        'settings.accentCyan',
      ]);
      expect(swatches().every((button) => button.classList.contains('w-11'))).toBe(true);
    });

    it('mirrors the back arrow in RTL and hides it from assistive technology', () => {
      const arrow = query('header button span');

      expect(arrow?.getAttribute('aria-hidden')).toBe('true');
      expect(arrow?.classList.contains('rtl:rotate-180')).toBe(true);
      expect(query('header button')?.getAttribute('aria-label')).toBe('common.back');
    });

    it('previews chat text with the shared size variable and keeps the sample out of the accessibility tree', () => {
      const preview = query('#appearance-chat-preview');

      expect(preview?.getAttribute('aria-hidden')).toBe('true');
      expect(preview?.innerHTML).toContain('--chat-message-font-size');
      expect(preview?.textContent).toContain('settings.chatTextSizePreviewMessage');
    });

    it('gives app and chat text size their own headings and groups', () => {
      expect(query('#appearance-text-size-heading')?.textContent).toContain('settings.appTextSize');
      expect(query('#appearance-chat-size-heading')?.textContent).toContain(
        'settings.chatTextSize',
      );
      expect(queryAll('[role="group"]').map((group) => group.getAttribute('aria-label'))).toEqual([
        'settings.themeLabel',
        'settings.appTextSize',
        'settings.chatTextSize',
      ]);
    });

    it('enables every chat text size once the stored value has loaded', () => {
      expect(component.loadFailed()).toBe(false);
      expect(chatSizeButtons()).toHaveLength(3);
      expect(chatSizeButtons().every((button) => !button.disabled)).toBe(true);
    });
  });
});
