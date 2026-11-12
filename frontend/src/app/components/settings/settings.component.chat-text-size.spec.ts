import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { SettingsComponent } from './settings.component';
import { CacheService } from '../../services/cache.service';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { I18nService } from '../../services/i18n.service';
import { LinkedAccountsService } from '../../services/linked-accounts.service';
import { UserService } from '../../services/user.service';

/**
 * Chat text size is chosen on Settings > Appearance, which previews it and applies
 * it immediately. The hub used to carry a second selector for the same stored
 * value, so a stale hub could overwrite what Appearance had saved.
 */
describe('SettingsComponent chat text size ownership', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let chatSettingsServiceMock: {
    enterToSend: WritableSignal<boolean>;
    textSize: WritableSignal<'small' | 'medium' | 'large'>;
    loadSettings: ReturnType<typeof vi.fn>;
    updateSetting: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    chatSettingsServiceMock = {
      enterToSend: signal(false),
      textSize: signal<'small' | 'medium' | 'large'>('large'),
      loadSettings: vi.fn().mockResolvedValue(true),
      updateSetting: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        { provide: Location, useValue: { back: vi.fn() } },
        { provide: CacheService, useValue: {} },
        { provide: ChatSettingsService, useValue: chatSettingsServiceMock },
        { provide: HapticFeedbackService, useValue: { setEnabled: vi.fn() } },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            availableLanguages: [],
            translate: vi.fn((key: string) => key),
          },
        },
        {
          provide: LinkedAccountsService,
          useValue: { getLinkedAccounts: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: UserService,
          useValue: {
            getMyProfile: vi.fn().mockResolvedValue({ id: '1', is_vip: false }),
            getAvailableInterests: vi.fn().mockResolvedValue([]),
            getMessageFilters: vi.fn().mockResolvedValue(null),
            updateMyProfile: vi.fn().mockResolvedValue({}),
            setMessageFilters: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // ngOnInit is asynchronous and is not tracked by whenStable().
    await vi.waitFor(() => {
      expect(component.isLoading()).toBe(false);
      expect(chatSettingsServiceMock.loadSettings).toHaveBeenCalledOnce();
    });
    fixture.detectChanges();
  });

  it('does not render a second chat text size selector', () => {
    const text = String(fixture.nativeElement.textContent);

    // The chat section itself is rendered, so the absence below is meaningful.
    expect(text).toContain('settings.chatSection');
    expect(text).not.toContain('settings.textSize');
    expect(fixture.nativeElement.querySelector('option[value="small"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('option[value="large"]')).toBeNull();
  });

  it('still links to Appearance, the one place chat text size is chosen', () => {
    expect(fixture.nativeElement.querySelector('a[href="/settings/appearance"]')).not.toBeNull();
  });

  it('keeps the other chat toggle in the hub', () => {
    expect(String(fixture.nativeElement.textContent)).toContain('settings.enterToSend');
  });

  it('never writes the chat text size when the hub saves', async () => {
    await component.saveSettings();

    expect(chatSettingsServiceMock.updateSetting).toHaveBeenCalledExactlyOnceWith(
      'enterToSend',
      false,
    );
    expect(chatSettingsServiceMock.updateSetting).not.toHaveBeenCalledWith(
      'textSize',
      expect.anything(),
    );
  });
});
