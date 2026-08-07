import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ChatSettingsComponent } from './chat-settings.component';
import { ChatSettingsService, InitialMessageFilterSettings } from '../../services/chat-settings.service';
import { I18nService, LanguageInfo } from '../../services/i18n.service';
import { signal } from '@angular/core';

const mockLanguages: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', isRtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRtl: false },
];

describe('ChatSettingsComponent', () => {
  let fixture: ComponentFixture<ChatSettingsComponent>;
  let mockChatSettingsService: Partial<ChatSettingsService>;
  let mockI18nService: Partial<I18nService>;

  beforeEach(async () => {
    mockChatSettingsService = {
      autoTranslate: signal(false),
      readReceipts: signal(false),
      enterToSend: signal(false),
      loaded: signal(true),
      initialMessageFilter: signal<InitialMessageFilterSettings>({ enabled: false }),
      filterLoaded: signal(true),
      loadSettings: vi.fn().mockResolvedValue(undefined),
      loadInitialMessageFilter: vi.fn().mockResolvedValue(undefined),
      updateSetting: vi.fn().mockResolvedValue(undefined),
      updateInitialMessageFilter: vi.fn().mockResolvedValue(undefined),
    } as unknown as ChatSettingsService;

    mockI18nService = {
      availableLanguages: mockLanguages,
      translations: signal<Record<string, string>>({}),
      translate: (key: string) => key,
    } as unknown as I18nService;

    await TestBed.configureTestingModule({
      imports: [ChatSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ChatSettingsService, useValue: mockChatSettingsService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatSettingsComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the chat settings title', () => {
    const h2 = fixture.nativeElement.querySelector('h2');
    expect(h2.textContent).toContain('chat_settings.title');
  });

  it('renders toggle switches for auto-translate, read receipts, and enter-to-send', () => {
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the initial message filter section', () => {
    const h3Elements = fixture.nativeElement.querySelectorAll('h3');
    const filterHeading = Array.from(h3Elements).find(
      (el: Element) => el.textContent?.includes('chat_settings.initial_message_filter'),
    );
    expect(filterHeading).toBeTruthy();
  });

  it('toggles filter enabled when filter enable switch is clicked', () => {
    const filterToggle = fixture.nativeElement.querySelector(
      '[aria-label="Toggle initial message filter"]',
    );
    expect(filterToggle).toBeTruthy();
    expect(fixture.componentInstance.filterEnabled()).toBe(false);

    filterToggle.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.filterEnabled()).toBe(true);
    expect(mockChatSettingsService.updateInitialMessageFilter).toHaveBeenCalled();
  });

  it('shows age range inputs and language picker when filter is enabled', () => {
    fixture.componentInstance.filterEnabled.set(true);
    fixture.detectChanges();

    const ageInputs = fixture.nativeElement.querySelectorAll('input[type="number"]');
    expect(ageInputs.length).toBe(2);

    const selectButton = fixture.nativeElement.querySelector('button');
    expect(selectButton).toBeTruthy();
  });
});