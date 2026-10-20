import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFilterService } from '../../../services/message-filter.service';
import { MessageFilterSettingsComponent } from './message-filter-settings.component';

describe('MessageFilterSettingsComponent', () => {
  let component: MessageFilterSettingsComponent;
  let messageFilterService: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    messageFilterService = {
      load: vi.fn().mockResolvedValue({}),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [MessageFilterSettingsComponent],
      providers: [
        { provide: MessageFilterService, useValue: messageFilterService },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    })
      .overrideComponent(MessageFilterSettingsComponent, { set: { template: '' } })
      .compileComponents();

    component = TestBed.createComponent(MessageFilterSettingsComponent).componentInstance;
  });

  it('loads persisted age, language, and gender filters without changing their meaning', async () => {
    messageFilterService.load.mockResolvedValue({
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
      age_min: 25,
      age_max: undefined,
      allowed_native_languages: ['ja'],
      allowed_genders: undefined,
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
