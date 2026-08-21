import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BlockedUsersService } from '../../../services/blocked-users.service';
import { I18nService } from '../../../services/i18n.service';
import { SafetyService } from '../../../services/safety.service';
import { PrivacySettingsComponent } from './privacy-settings.component';

describe('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;
  const mutedWords = signal<string[]>([]);
  const blockedUsers = signal<unknown[]>([]);
  const addMutedWord = vi.fn<(word: string) => void>();
  const removeMutedWord = vi.fn<(word: string) => void>();
  const goBack = vi.fn();

  beforeEach(async () => {
    mutedWords.set([]);
    blockedUsers.set([]);
    addMutedWord.mockReset();
    removeMutedWord.mockReset();
    goBack.mockReset();

    addMutedWord.mockImplementation((word) => {
      mutedWords.update((previous) => (previous.includes(word) ? previous : [...previous, word]));
    });
    removeMutedWord.mockImplementation((word) => {
      mutedWords.update((previous) => previous.filter((item) => item !== word));
    });

    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
      providers: [
        provideRouter([]),
        {
          provide: SafetyService,
          useValue: { mutedWords, addMutedWord, removeMutedWord },
        },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers,
            loadBlockedUsers: vi.fn().mockResolvedValue(undefined),
          },
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

  it('creates and renders the privacy hub', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement | null;
    expect(heading?.textContent?.trim()).toBe('privacy.hub.title');
    expect(component.hubNavItems.length).toBeGreaterThan(0);
  });

  it('exposes a screen-reader name for the muted-word input and add action', () => {
    const input = fixture.nativeElement.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement | null;
    const addButton = fixture.nativeElement.querySelector(
      'button[aria-label="privacy.hub.addMutedWord"]',
    ) as HTMLButtonElement | null;

    expect(input).not.toBeNull();
    expect(input?.getAttribute('aria-label')).toBe('privacy.hub.addMutedWordPlaceholder');
    expect(addButton).not.toBeNull();
  });

  it('adds a muted word when Enter is pressed in the input', () => {
    component.mutedWordInput.set('  Spoiler  ');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(addMutedWord).toHaveBeenCalledWith('spoiler');
    expect(component.mutedWordInput()).toBe('');
  });

  it('adds a muted word from the native button action', () => {
    component.mutedWordInput.set('spoiler');
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      'button[aria-label="privacy.hub.addMutedWord"]',
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    expect(addMutedWord).toHaveBeenCalledWith('spoiler');
    expect(mutedWords()).toEqual(['spoiler']);
  });

  it('renders a contextual accessible name for each remove action', () => {
    mutedWords.set(['spoiler']);
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="privacy.hub.removeMutedWordAria:spoiler"]',
    ) as HTMLButtonElement | null;

    expect(removeButton).not.toBeNull();
  });

  it('removes a muted word from the native button action', () => {
    mutedWords.set(['spoiler']);
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="privacy.hub.removeMutedWordAria:spoiler"]',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(removeMutedWord).toHaveBeenCalledWith('spoiler');
    expect(mutedWords()).toEqual([]);
  });

  it('keeps hub navigation links keyboard-focusable', () => {
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
