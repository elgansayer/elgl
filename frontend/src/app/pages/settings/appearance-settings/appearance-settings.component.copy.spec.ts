import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { AuthService } from '../../../services/auth.service';
import { ChatSettingsService } from '../../../services/chat-settings.service';
import { FontScaleService } from '../../../services/font-scale.service';
import { I18nService } from '../../../services/i18n.service';
import { ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';

/**
 * The component spec replaces the translate pipe with one that echoes the key, so
 * it cannot notice a key that is missing from the dictionary: the page would then
 * show the raw key to users. These tests render the page with the real
 * I18nService and fail on any key that has no copy.
 */
describe('AppearanceSettingsComponent copy', () => {
  let fixture: ComponentFixture<AppearanceSettingsComponent>;
  let component: AppearanceSettingsComponent;
  let i18n: I18nService;
  let translate: MockInstance<I18nService['translate']>;
  let userServiceMock: {
    getMyProfile: ReturnType<typeof vi.fn>;
    updateMyProfile: ReturnType<typeof vi.fn>;
  };
  let chatSettingsServiceMock: {
    textSize: WritableSignal<'small' | 'medium' | 'large'>;
    loadSettings: ReturnType<typeof vi.fn>;
    updateSetting: ReturnType<typeof vi.fn>;
  };

  const vipProfile = { id: '1', is_vip: true, primary_accent_color: '#c65230' };

  beforeEach(async () => {
    localStorage.clear();

    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue(vipProfile),
      updateMyProfile: vi.fn().mockResolvedValue({}),
    };
    chatSettingsServiceMock = {
      textSize: signal<'small' | 'medium' | 'large'>('medium'),
      loadSettings: vi.fn().mockResolvedValue(true),
      updateSetting: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [AppearanceSettingsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getAccessToken: vi.fn().mockReturnValue(null) } },
        { provide: UserService, useValue: userServiceMock },
        { provide: ChatSettingsService, useValue: chatSettingsServiceMock },
        { provide: Location, useValue: { back: vi.fn() } },
        {
          provide: ThemeService,
          useValue: {
            currentTheme: signal('system'),
            setTheme: vi.fn(),
            setPrimaryAccentColor: vi.fn(),
            resetPrimaryAccentColor: vi.fn(),
            loadFromProfile: vi.fn(),
          },
        },
        {
          provide: FontScaleService,
          useValue: {
            scaleFactor: signal(1),
            textSizePreference: signal('normal'),
            chatTextSize: signal('medium'),
            setTextSizePreference: vi.fn(),
            setChatTextSize: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    translate = vi.spyOn(i18n, 'translate');
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(AppearanceSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Every key the page asked for must have copy; a missing key is echoed back verbatim. */
  function expectNoRawKeys(): void {
    const requested = new Set(translate.mock.calls.map(([key]) => key));
    expect(requested.size).toBeGreaterThan(10);
    const unresolved = [...requested].filter((key) => i18n.translate(key) === key);
    expect(unresolved).toEqual([]);
  }

  const text = (): string => String(fixture.nativeElement.textContent).replace(/\s+/g, ' ');

  it('shows real copy for a VIP account', async () => {
    await render();

    expectNoRawKeys();
    expect(text()).toContain('App text size');
    expect(text()).toContain('Chat text size');
    expect(text()).toContain('Custom colour');
    expect(text()).toContain('Small');
    expect(text()).toContain('Medium');
    expect(text()).toContain('Large');
    expect(text()).toContain('Light');
    expect(text()).toContain('Dark');
    expect(text()).toContain('Interface language');
  });

  it('shows real copy for an account without the VIP entitlement', async () => {
    userServiceMock.getMyProfile.mockResolvedValue({ id: '2', is_vip: false });
    await render();

    expectNoRawKeys();
    expect(text()).toContain('VIP');
  });

  it('names each accent swatch with a readable colour rather than a hex code', async () => {
    await render();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        'button[aria-pressed][aria-label]',
      ) as NodeListOf<Element>,
    )
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('Select colour'));

    expect(labels).toEqual([
      'Select colour Ember',
      'Select colour Tide',
      'Select colour Gold',
      'Select colour Raspberry',
      'Select colour Violet',
      'Select colour Cyan',
    ]);
  });

  it('shows real copy and a retry action when the stored settings cannot be loaded', async () => {
    userServiceMock.getMyProfile.mockResolvedValue(null);
    chatSettingsServiceMock.loadSettings.mockResolvedValue(false);
    await render();

    expectNoRawKeys();
    expect(text()).toContain('We could not load your saved appearance settings.');
    expect(text()).toContain('Retry');
  });

  it('shows real copy for an invalid accent colour', async () => {
    await render();
    component.primaryAccentColor.set('#c65');
    fixture.detectChanges();

    expectNoRawKeys();
    expect(text()).toContain('Enter a six-digit hex colour');
  });

  it('shows real copy after a successful and a failed save', async () => {
    await render();

    await component.saveSettings();
    fixture.detectChanges();
    expectNoRawKeys();
    expect(text()).toContain('Saved');

    userServiceMock.updateMyProfile.mockRejectedValue(new Error('503'));
    component.setAccentColor('#1A8478');
    await component.saveSettings();
    fixture.detectChanges();

    expectNoRawKeys();
    expect(text()).toContain('Your changes could not be saved.');
  });

  it('keeps English copy free of em dashes', () => {
    const keys = [
      'settings.appTextSize',
      'settings.appTextSizeDescription',
      'settings.chatTextSize',
      'settings.chatTextSizeDescription',
      'settings.chatTextSizePreview',
      'settings.chatTextSizePreviewMessage',
      'settings.customColourLabel',
      'settings.customColourPlaceholder',
      'settings.accentColourInvalid',
      'settings.appearanceLoadError',
      'settings.appearanceSaveError',
    ];

    for (const key of keys) {
      expect(i18n.translate(key)).not.toBe(key);
      expect(i18n.translate(key)).not.toContain(String.fromCharCode(0x2014));
    }
  });
});
