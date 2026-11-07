import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';
import { SAFETY_REPORT_CATEGORIES, SafetyService } from './safety.service';

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

    for (const invalidId of ['', '   ', ' padded-id ']) {
      get.mockReturnValueOnce(of(['valid-id', invalidId]));
      await expect(service.getBlockedAndBlockerIdsStrict('user-a')).rejects.toThrow(
        'Invalid block graph response',
      );
    }
  });
});

describe('SafetyService block and report API', () => {
  const TARGET_ID = '22222222-2222-4222-8222-222222222222';
  const OTHER_ID = '33333333-3333-4333-8333-333333333333';
  const api = environment.apiUrl;
  let service: SafetyService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        SafetyService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 'user-a' }),
            getAccessToken: vi.fn(() => 'token'),
          },
        },
        { provide: I18nService, useValue: { translate: (key: string) => `t:${key}` } },
      ],
    });
    service = TestBed.inject(SafetyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('reporting', () => {
    it('posts the report to the safety API and exposes whether it was a repeat', async () => {
      const dto = {
        reported_id: TARGET_ID,
        reason_category: 'harassment' as const,
        description: 'Abusive messages',
        context_url: '/chat/room-1',
      };

      const pending = service.reportUserAsync(dto);
      const request = http.expectOne(`${api}/safety/report`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(dto);
      request.flush({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: true,
      });

      await expect(pending).resolves.toEqual({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: true,
      });
    });

    it('rejects when the API refuses the report so callers never show a false success', async () => {
      const pending = service.reportUserAsync({
        reported_id: TARGET_ID,
        reason_category: 'spam',
      });
      http
        .expectOne(`${api}/safety/report`)
        .flush(
          { message: 'Report limit reached' },
          { status: 429, statusText: 'Too Many Requests' },
        );

      await expect(pending).rejects.toMatchObject({ status: 429 });
    });
  });

  describe('blocking', () => {
    it('adds the account to the shared cache only after the API accepted the block', async () => {
      const pending = service.blockUserAsync(TARGET_ID);
      expect(service.isUserBlockedCached(TARGET_ID)).toBe(false);

      const request = http.expectOne(`${api}/safety/block/${TARGET_ID}`);
      expect(request.request.method).toBe('POST');
      request.flush({ success: true, blocked_id: TARGET_ID, already_blocked: false });

      await expect(pending).resolves.toEqual({
        success: true,
        blocked_id: TARGET_ID,
        already_blocked: false,
      });
      expect(service.isUserBlockedCached(TARGET_ID)).toBe(true);
      expect(service.blockedUserIdsSignal().has(TARGET_ID)).toBe(true);
    });

    it('treats a repeated block as success and keeps a single cache entry', async () => {
      const pending = service.blockUserAsync(TARGET_ID);
      http
        .expectOne(`${api}/safety/block/${TARGET_ID}`)
        .flush({ success: true, blocked_id: TARGET_ID, already_blocked: true });

      const result = await pending;

      expect(result.already_blocked).toBe(true);
      expect([...service.blockedUserIdsSignal()]).toEqual([TARGET_ID]);
    });

    it('leaves the cache untouched and rejects when the block fails', async () => {
      service.setBlockedUserLocal(OTHER_ID, true);

      const pending = service.blockUserAsync(TARGET_ID);
      http
        .expectOne(`${api}/safety/block/${TARGET_ID}`)
        .flush({ message: 'Unable to block user' }, { status: 500, statusText: 'Server Error' });

      await expect(pending).rejects.toMatchObject({ status: 500 });
      expect(service.isUserBlockedCached(TARGET_ID)).toBe(false);
      expect(service.isUserBlockedCached(OTHER_ID)).toBe(true);
    });

    it('removes the account from the cache once the unblock succeeded', async () => {
      service.setBlockedUserLocal(TARGET_ID, true);
      service.setBlockedUserLocal(OTHER_ID, true);

      const pending = service.unblockUserAsync(TARGET_ID);
      const request = http.expectOne(`${api}/safety/unblock/${TARGET_ID}`);
      expect(request.request.method).toBe('POST');
      request.flush({ success: true });

      await expect(pending).resolves.toEqual({ success: true });
      expect([...service.blockedUserIdsSignal()]).toEqual([OTHER_ID]);
    });

    it('keeps the block in the cache and rejects when the unblock fails', async () => {
      service.setBlockedUserLocal(TARGET_ID, true);

      const pending = service.unblockUserAsync(TARGET_ID);
      http
        .expectOne(`${api}/safety/unblock/${TARGET_ID}`)
        .flush({ message: 'Unable to unblock user' }, { status: 500, statusText: 'Server Error' });

      await expect(pending).rejects.toMatchObject({ status: 500 });
      expect(service.isUserBlockedCached(TARGET_ID)).toBe(true);
    });
  });

  describe('report categories', () => {
    it('returns the catalogue served by the API', async () => {
      const categories = [{ value: 'spam', label: 'Spam', description: 'Unsolicited promotions' }];

      const pending = service.getReportCategories();
      http.expectOne(`${api}/safety/report-categories`).flush(categories);

      await expect(pending).resolves.toEqual(categories);
    });

    it('falls back to the translated contract categories when the API is unavailable', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const pending = service.getReportCategories();
      http
        .expectOne(`${api}/safety/report-categories`)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });

      const categories = await pending;

      expect(categories.map((category) => category.value)).toEqual([...SAFETY_REPORT_CATEGORIES]);
      expect(categories.map((category) => category.value)).toEqual([
        'harassment',
        'spam',
        'inappropriate_content',
        'fake_profile',
        'other',
      ]);
      for (const category of categories) {
        expect(category.label).toBe(`t:report.category.${category.value}.label`);
        expect(category.description).toBe(`t:report.category.${category.value}.description`);
      }
    });
  });
});
