import { HttpClient, provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';

describe('SafetyService muted words', () => {
  const currentUser = signal<{ id: string } | null>({ id: 'user-a' });
  let service: SafetyService;

  const ownerKey = (owner: string) => `hellotalk_muted_words:${encodeURIComponent(owner)}`;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    currentUser.set({ id: 'user-a' });

    TestBed.configureTestingModule({
      providers: [
        SafetyService,
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: {
            currentUser,
            getAccessToken: vi.fn(() => 'token'),
          },
        },
      ],
    });

    service = TestBed.inject(SafetyService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('stores muted words in an account-specific namespace', () => {
    service.addMutedWord('Spoiler');

    expect(service.mutedWords()).toEqual(['spoiler']);
    expect(localStorage.getItem(ownerKey('user-a'))).toBe('["spoiler"]');
    expect(localStorage.getItem('hellotalk_muted_words')).toBeNull();
  });

  it('keeps anonymous muted words isolated from authenticated accounts', () => {
    currentUser.set(null);
    service.addMutedWord('anonymous-only');

    expect(localStorage.getItem(ownerKey('anonymous'))).toBe('["anonymous-only"]');

    currentUser.set({ id: 'user-b' });

    expect(service.isMutedWord('anonymous-only')).toBe(false);
    expect(service.mutedWords()).toEqual([]);
  });

  it('switches muted-word state when the authenticated account changes', () => {
    localStorage.setItem(ownerKey('user-a'), '["alpha"]');
    localStorage.setItem(ownerKey('user-b'), '["beta"]');

    currentUser.set({ id: 'user-b' });
    expect(service.isMutedWord('alpha')).toBe(false);
    expect(service.isMutedWord('beta')).toBe(true);

    currentUser.set({ id: 'user-a' });
    expect(service.isMutedWord('alpha')).toBe(true);
    expect(service.isMutedWord('beta')).toBe(false);
    expect(service.mutedWords()).toEqual(['alpha']);
  });

  it('migrates the legacy device-global value only for an authenticated account', () => {
    localStorage.setItem('hellotalk_muted_words', '["Spoiler", "SPOILER", "café"]');
    currentUser.set(null);

    expect(service.isMutedWord('spoiler')).toBe(false);
    expect(localStorage.getItem('hellotalk_muted_words')).not.toBeNull();

    currentUser.set({ id: 'user-a' });

    expect(service.isMutedWord('spoiler')).toBe(true);
    expect(service.mutedWords()).toEqual(['spoiler', 'café']);
    expect(localStorage.getItem(ownerKey('user-a'))).toBe('["spoiler","café"]');
    expect(localStorage.getItem('hellotalk_muted_words')).toBeNull();
  });

  it('does not let localStorage failures break in-memory filtering', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    expect(() => service.addMutedWord('spoiler')).not.toThrow();
    expect(
      service.filterMomentsByMutedWords([
        { id: 'hidden', text_content: 'Spoiler warning' },
        { id: 'visible', text_content: 'Hello world' },
      ]),
    ).toEqual([{ id: 'visible', text_content: 'Hello world' }]);
  });

  it('matches whole word-like tokens without accidental substrings', () => {
    service.addMutedWord('art');

    const visible = service.filterMomentsByMutedWords([
      { id: 'word', text_content: 'Art is everywhere.' },
      { id: 'punctuation', text_content: 'I bought #art!' },
      { id: 'substring', text_content: 'The party starts at eight.' },
    ]);

    expect(visible).toEqual([{ id: 'substring', text_content: 'The party starts at eight.' }]);
  });

  it('normalises Unicode and case before matching', () => {
    service.addMutedWord('CAFÉ');

    const visible = service.filterMomentsByMutedWords([
      { id: 'composed', content_text: 'Meet me at Café Central.' },
      { id: 'decomposed', content_text: 'The cafe\u0301 is open.' },
      { id: 'other', content_text: 'Tea is ready.' },
    ]);

    expect(visible).toEqual([{ id: 'other', content_text: 'Tea is ready.' }]);
  });

  it('matches multi-word phrases across normal punctuation boundaries', () => {
    service.addMutedWord('climate change');

    const visible = service.filterMomentsByMutedWords([
      { id: 'space', text_content: 'Climate change matters.' },
      { id: 'punctuated', text_content: 'Climate, change and policy.' },
      { id: 'different', text_content: 'The climate changes every season.' },
    ]);

    expect(visible).toEqual([
      { id: 'different', text_content: 'The climate changes every season.' },
    ]);
  });

  it('keeps media-only and empty Moments visible', () => {
    service.addMutedWord('spoiler');

    const moments = [
      { id: 'missing' },
      { id: 'null', text_content: null },
      { id: 'empty', content_text: '' },
    ];

    expect(service.filterMomentsByMutedWords(moments)).toEqual(moments);
  });

  it('reacts immediately to adding and removing a muted word without a refetch', () => {
    const moments = [{ id: 'moment', text_content: 'This contains a spoiler.' }];

    expect(service.filterMomentsByMutedWords(moments)).toEqual(moments);

    service.addMutedWord('spoiler');
    expect(service.filterMomentsByMutedWords(moments)).toEqual([]);

    service.removeMutedWord('spoiler');
    expect(service.filterMomentsByMutedWords(moments)).toEqual(moments);
  });

  it('matches explicit symbol and emoji mute terms', () => {
    service.addMutedWord('🤐');

    expect(
      service.filterMomentsByMutedWords([
        { id: 'hidden', text_content: 'Secret 🤐 post' },
        { id: 'visible', text_content: 'Public post' },
      ]),
    ).toEqual([{ id: 'visible', text_content: 'Public post' }]);
  });

  it('strictly loads, validates and deduplicates the block graph', async () => {
    vi.spyOn(TestBed.inject(HttpClient), 'get').mockReturnValue(
      of(['blocked-user', 'blocker-user', 'blocked-user']),
    );

    await expect(service.getBlockedAndBlockerIdsStrict('user-a')).resolves.toEqual([
      'blocked-user',
      'blocker-user',
    ]);
  });

  it('rejects unavailable or malformed strict block graphs', async () => {
    const get = vi.spyOn(TestBed.inject(HttpClient), 'get');
    get.mockReturnValueOnce(throwError(() => new Error('service unavailable')));
    await expect(service.getBlockedAndBlockerIdsStrict('user-a')).rejects.toThrow(
      'service unavailable',
    );

    get.mockReturnValueOnce(of(['valid-id', null]));
    await expect(service.getBlockedAndBlockerIdsStrict('user-a')).rejects.toThrow(
      'Invalid block graph response',
    );
  });
});
