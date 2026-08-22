import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BlockedUsersService } from '../../../services/blocked-users.service';
import { I18nService } from '../../../services/i18n.service';
import { MutedWordsApiService } from '../../../services/muted-words-api.service';
import {
  ProfileVisibility,
  ProfileVisibilityService,
} from '../../../services/profile-visibility.service';
import { SafetyService } from '../../../services/safety.service';
import { PrivacySettingsComponent } from './privacy-settings.component';

describe('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;

  const mutedWords = signal<string[]>([]);
  const blockedUsers = signal<unknown[]>([]);
  const addMutedWord = vi.fn<(word: string) => void>();
  const removeMutedWord = vi.fn<(word: string) => void>();
  const clearMutedWords = vi.fn<() => void>();
  const listMutedWords = vi.fn<() => Promise<string[]>>();
  const persistMutedWord = vi.fn<(word: string) => Promise<string[]>>();
  const deleteMutedWord = vi.fn<(word: string) => Promise<string[]>>();
  const goBack = vi.fn();
  const getProfileVisibility = vi.fn<() => Promise<ProfileVisibility>>();
  const updateProfileVisibility = vi.fn<
    (value: ProfileVisibility) => Promise<void>
  >();

  beforeEach(async () => {
    vi.clearAllMocks();
    mutedWords.set([]);
    blockedUsers.set([]);
    getProfileVisibility.mockResolvedValue('everyone');
    updateProfileVisibility.mockResolvedValue(undefined);
    listMutedWords.mockResolvedValue([]);
    persistMutedWord.mockImplementation(async (word) => [word]);
    deleteMutedWord.mockResolvedValue([]);

    addMutedWord.mockImplementation((word) => {
      mutedWords.update((previous) =>
        previous.includes(word) ? previous : [...previous, word],
      );
    });
    removeMutedWord.mockImplementation((word) => {
      mutedWords.update((previous) =>
        previous.filter((item) => item !== word),
      );
    });
    clearMutedWords.mockImplementation(() => mutedWords.set([]));

    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
      providers: [
        provideRouter([]),
        {
          provide: SafetyService,
          useValue: {
            mutedWords,
            addMutedWord,
            removeMutedWord,
            clearMutedWords,
          },
        },
        {
          provide: MutedWordsApiService,
          useValue: {
            list: listMutedWords,
            add: persistMutedWord,
            remove: deleteMutedWord,
          },
        },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers,
            loadBlockedUsers: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProfileVisibilityService,
          useValue: { getProfileVisibility, updateProfileVisibility },
        },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => {
              const word = params?.['word'];
              return typeof word === 'string' ? `${key}:${word}` : key;
            },
          },
        },
        { provide: Location, useValue: { back: goBack } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads account muted words and replaces the local cache', async () => {
    listMutedWords.mockResolvedValueOnce(['spoiler', 'politics']);

    await component.loadMutedWords();

    expect(clearMutedWords).toHaveBeenCalled();
    expect(addMutedWord).toHaveBeenCalledWith('spoiler');
    expect(addMutedWord).toHaveBeenCalledWith('politics');
    expect(mutedWords()).toEqual(['spoiler', 'politics']);
    expect(component.mutedWordsError()).toBe(false);
  });

  it('keeps the local fallback and exposes retry when loading fails', async () => {
    mutedWords.set(['offline-word']);
    listMutedWords.mockRejectedValueOnce(new Error('offline'));

    await component.loadMutedWords();
    fixture.detectChanges();

    expect(mutedWords()).toEqual(['offline-word']);
    expect(component.mutedWordsError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('normalises and persists a new word before replacing local state', async () => {
    persistMutedWord.mockResolvedValueOnce(['spoiler', 'café']);
    component.mutedWordInput.set('  ＳＰＯＩＬＥＲ  ');

    await component.addMutedWord();

    expect(persistMutedWord).toHaveBeenCalledWith('spoiler');
    expect(mutedWords()).toEqual(['spoiler', 'café']);
    expect(component.mutedWordInput()).toBe('');
    expect(component.mutedWordsSaving()).toBe(false);
  });

  it('retains the input and local cache when a save fails', async () => {
    mutedWords.set(['existing']);
    component.mutedWordInput.set('spoiler');
    persistMutedWord.mockRejectedValueOnce(new Error('offline'));

    await component.addMutedWord();

    expect(component.mutedWordInput()).toBe('spoiler');
    expect(mutedWords()).toEqual(['existing']);
    expect(component.mutedWordsError()).toBe(true);
  });

  it('removes a word only after the backend returns canonical state', async () => {
    mutedWords.set(['spoiler', 'politics']);
    deleteMutedWord.mockResolvedValueOnce(['politics']);

    await component.removeMutedWord('spoiler');

    expect(deleteMutedWord).toHaveBeenCalledWith('spoiler');
    expect(mutedWords()).toEqual(['politics']);
  });

  it('does not persist duplicates or invalid overlong words', async () => {
    mutedWords.set(['spoiler']);
    component.mutedWordInput.set('SPOILER');
    await component.addMutedWord();

    component.mutedWordInput.set('x'.repeat(65));
    await component.addMutedWord();

    expect(persistMutedWord).not.toHaveBeenCalled();
  });

  it('exposes accessible bounded controls for muted words', () => {
    const input = fixture.nativeElement.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement | null;
    const addButton = fixture.nativeElement.querySelector(
      'button[aria-label="privacy.hub.addMutedWord"]',
    ) as HTMLButtonElement | null;

    expect(input?.maxLength).toBe(64);
    expect(input?.getAttribute('aria-describedby')).toBe('muted-words-status');
    expect(addButton).not.toBeNull();
  });

  it('renders a contextual accessible name for remove actions', () => {
    mutedWords.set(['spoiler']);
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="privacy.hub.removeMutedWordAria:spoiler"]',
    ) as HTMLButtonElement | null;
    expect(removeButton).not.toBeNull();
  });

  it('persists profile visibility and rolls back failures', async () => {
    await component.updateProfileVisibility('vips_only');
    expect(updateProfileVisibility).toHaveBeenCalledWith('vips_only');
    expect(component.profileVisibility()).toBe('vips_only');

    updateProfileVisibility.mockRejectedValueOnce(new Error('offline'));
    await component.updateProfileVisibility('hidden');
    expect(component.profileVisibility()).toBe('vips_only');
    expect(component.visibilitySaveError()).toBe(true);
  });

  it('keeps hub navigation keyboard-focusable', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>,
    );
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.tabIndex >= 0)).toBe(true);
  });

  it('delegates Back to the browser location service', () => {
    component.goBack();
    expect(goBack).toHaveBeenCalledOnce();
  });
});
