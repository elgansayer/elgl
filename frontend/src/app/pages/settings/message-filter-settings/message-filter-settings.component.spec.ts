import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../services/auth.service';
import { I18nService } from '../../../services/i18n.service';
import { MessageFilterService } from '../../../services/message-filter.service';
import { MessageFilterSettingsComponent } from './message-filter-settings.component';

describe('MessageFilterSettingsComponent', () => {
  let fixture: ComponentFixture<MessageFilterSettingsComponent>;
  let component: MessageFilterSettingsComponent;
  let i18n: I18nService;
  let messageFilterService: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    localStorage.clear();
    messageFilterService = {
      load: vi.fn().mockResolvedValue({}),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [MessageFilterSettingsComponent],
      providers: [
        { provide: MessageFilterService, useValue: messageFilterService },
        { provide: Location, useValue: { back: vi.fn() } },
        { provide: AuthService, useValue: { getAccessToken: vi.fn(() => null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageFilterSettingsComponent);
    component = fixture.componentInstance;
    i18n = TestBed.inject(I18nService);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('exposes the same inclusive age boundaries as the API contract', () => {
    const minimumAge = fixture.nativeElement.querySelector('#age-min') as HTMLInputElement;
    const maximumAge = fixture.nativeElement.querySelector('#age-max') as HTMLInputElement;

    expect(minimumAge.min).toBe('0');
    expect(minimumAge.max).toBe('120');
    expect(maximumAge.min).toBe('0');
    expect(maximumAge.max).toBe('120');

    minimumAge.value = '0';
    minimumAge.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.ageMin()).toBe(0);
  });

  it('exposes language and gender selections as pressed button state', () => {
    component.selectedLanguages.set(['ja']);
    component.selectedGenders.set(['female']);
    fixture.detectChanges();

    const japanese = fixture.nativeElement.querySelector(
      'button[data-language-code="ja"]',
    ) as HTMLButtonElement;
    const english = fixture.nativeElement.querySelector(
      'button[data-language-code="en"]',
    ) as HTMLButtonElement;
    const female = fixture.nativeElement.querySelector(
      'button[data-gender-code="female"]',
    ) as HTMLButtonElement;

    expect(japanese.getAttribute('aria-pressed')).toBe('true');
    expect(english.getAttribute('aria-pressed')).toBe('false');
    expect(female.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the save action with the touch-safe Spartan size', () => {
    const save = fixture.nativeElement.querySelector('button.w-full') as HTMLButtonElement;

    expect(save.classList.contains('min-h-11')).toBe(true);
  });

  it('renders selected-language removal as a keyboard-operable named button', () => {
    component.selectedLanguages.set(['ja']);
    fixture.detectChanges();

    const remove = fixture.nativeElement.querySelector(
      'button[data-remove-language-code="ja"]',
    ) as HTMLButtonElement;

    expect(remove).toBeTruthy();
    expect(remove.getAttribute('aria-label')).toBe('Remove Japanese');
    remove.click();
    fixture.detectChanges();
    expect(component.selectedLanguages()).toEqual([]);
  });

  it('renders language names and removal labels from a non-English dictionary', async () => {
    localStorage.setItem(
      'hellotalk_dict_ja',
      JSON.stringify({
        'languageName.ja': '日本語',
        'settings.messageFilters.removeLanguage': '{{language}}を削除',
      }),
    );
    await i18n.setLanguage('ja');
    component.selectedLanguages.set(['ja']);
    fixture.detectChanges();

    const japanese = fixture.nativeElement.querySelector(
      'button[data-language-code="ja"]',
    ) as HTMLButtonElement;
    const remove = fixture.nativeElement.querySelector(
      'button[data-remove-language-code="ja"]',
    ) as HTMLButtonElement;

    expect(japanese.textContent?.trim()).toBe('日本語');
    expect(remove.getAttribute('aria-label')).toBe('日本語を削除');
  });

  it('loads persisted age, language, and gender filters without changing their meaning', async () => {
    messageFilterService.load.mockResolvedValue({
      enabled: true,
      allow_everyone: false,
      age_min: 21,
      age_max: 40,
      allowed_native_languages: ['ja', 'ko'],
      allowed_genders: ['female'],
    });

    await component.loadFilters();

    expect(component.loadFailed()).toBe(false);
    expect(component.ageMin()).toBe(21);
    expect(component.ageMax()).toBe(40);
    expect(component.selectedLanguages()).toEqual(['ja', 'ko']);
    expect(component.selectedGenders()).toEqual(['female']);
  });

  it('blocks editing state behind a retryable failure instead of treating an outage as empty filters', async () => {
    messageFilterService.load.mockRejectedValueOnce(new Error('offline'));

    await component.loadFilters();

    expect(component.isLoading()).toBe(false);
    expect(component.loadFailed()).toBe(true);

    messageFilterService.load.mockResolvedValueOnce({ age_min: 18 });
    await component.loadFilters();

    expect(component.loadFailed()).toBe(false);
    expect(component.ageMin()).toBe(18);
  });

  it('saves only configured filters and reports successful persistence', async () => {
    component.ageMin.set(25);
    component.ageMax.set(null);
    component.selectedLanguages.set(['ja']);
    component.selectedGenders.set([]);

    await component.saveFilters();

    expect(messageFilterService.save).toHaveBeenCalledWith({
      enabled: true,
      allow_everyone: false,
      age_min: 25,
      age_max: undefined,
      allowed_native_languages: ['ja'],
      allowed_genders: [],
      same_native_language: false,
      same_target_language: false,
      same_gender: false,
      same_age: false,
    });
    expect(component.successMessage()).toBe('settings.messageFilters.saved');
    expect(component.errorMessage()).toBe('');
  });

  it('reports save failures and never converts them into a success state', async () => {
    messageFilterService.save.mockRejectedValueOnce(new Error('write failed'));

    await component.saveFilters();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toBe('settings.messageFilters.saveError');
    expect(component.isSaving()).toBe(false);
  });

  it('does not save while the initial filter state is unavailable', async () => {
    component.loadFailed.set(true);

    await component.saveFilters();

    expect(messageFilterService.save).not.toHaveBeenCalled();
  });

  it('rejects an inverted age range on the client without sending a save request', async () => {
    component.ageMin.set(50);
    component.ageMax.set(20);

    await component.saveFilters();

    expect(messageFilterService.save).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('settings.messageFilters.invalidAgeRange');
    expect(component.isSaving()).toBe(false);
  });

  it.each([-1, 121])(
    'rejects age %i outside the API boundary without sending a save request',
    async (age) => {
      component.ageMin.set(age);

      await component.saveFilters();

      expect(messageFilterService.save).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('settings.messageFilters.invalidAge');
      expect(component.isSaving()).toBe(false);
    },
  );

  it('suppresses duplicate save requests while a persistence request is pending', async () => {
    let resolveSave: (() => void) | undefined;
    messageFilterService.save.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );

    const firstSave = component.saveFilters();
    const secondSave = component.saveFilters();

    expect(component.isSaving()).toBe(true);
    expect(messageFilterService.save).toHaveBeenCalledTimes(1);

    resolveSave?.();
    await Promise.all([firstSave, secondSave]);

    expect(component.isSaving()).toBe(false);
  });
});
