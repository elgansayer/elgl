import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DraftService } from './draft.service';
import { AuthService } from './auth.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

const chatKey = (userId: string, roomId: string): string =>
  `ht_${userId}_draft_chat_v2_${roomId}`;
const rawChatKey = (userId: string, roomId: string): string => `ht_${userId}_draft_chat_${roomId}`;
const momentKey = (userId: string): string => `ht_${userId}_draft_moment`;

function seed(key: string, value: unknown): void {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function stored(key: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

describe('DraftService', () => {
  let service: DraftService;
  let mockAuth: { currentUser: () => { id: string } | null };

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    mockAuth = {
      currentUser: () => ({ id: 'test-user-1' }),
    };

    TestBed.configureTestingModule({
      providers: [DraftService, { provide: AuthService, useValue: mockAuth }],
    });

    service = TestBed.inject(DraftService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('chat drafts', () => {
    it('saves and loads a chat draft', () => {
      service.saveChatDraft('room-1', 'Hello there');
      expect(service.loadChatDraft('room-1')).toBe('Hello there');
    });

    it('returns empty string for a non-existent or invalid room draft', () => {
      expect(service.loadChatDraft('room-999')).toBe('');
      expect(service.loadChatDraft('   ')).toBe('');
    });

    it('clears a chat draft when saving empty text', () => {
      service.saveChatDraft('room-1', 'Hello');
      service.saveChatDraft('room-1', '');
      expect(service.loadChatDraft('room-1')).toBe('');
    });

    it('clears a chat draft explicitly', () => {
      service.saveChatDraft('room-1', 'Hello');
      service.clearChatDraft('room-1');
      expect(service.loadChatDraft('room-1')).toBe('');
    });

    it('stores drafts per room separately', () => {
      service.saveChatDraft('room-1', 'Message in room 1');
      service.saveChatDraft('room-2', 'Message in room 2');
      expect(service.loadChatDraft('room-1')).toBe('Message in room 1');
      expect(service.loadChatDraft('room-2')).toBe('Message in room 2');
    });

    it('round-trips enriched reply and correction state', () => {
      service.saveChatDraftV2('room-1', {
        textInput: 'Reply text',
        replyToId: 'message-1',
        originalText: 'I goed home',
        correctedText: 'I went home',
        explanationText: 'Use the irregular past tense.',
      });

      expect(service.loadChatDraftV2('room-1')).toEqual({
        textInput: 'Reply text',
        replyToId: 'message-1',
        originalText: 'I goed home',
        correctedText: 'I went home',
        explanationText: 'Use the irregular past tense.',
      });
    });

    it('drops corrupt enriched drafts instead of throwing repeatedly', () => {
      const key = 'ht_test-user-1_draft_chat_v2_room-1';
      localStorage.setItem(key, '{not-json');

      expect(service.loadChatDraftV2('room-1')).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    });

    it('does not persist oversized chat text', () => {
      service.saveChatDraft('room-1', 'x'.repeat(10_001));
      expect(service.loadChatDraft('room-1')).toBe('');
    });

    it('keeps the reply target when only the text is updated', () => {
      service.saveChatDraftV2('room-1', { textInput: 'First', replyToId: 'message-1' });

      service.saveChatDraft('room-1', 'Second');

      expect(service.loadChatDraftV2('room-1')).toEqual({
        textInput: 'Second',
        replyToId: 'message-1',
      });
    });

    it('keeps a reply-only draft when the text is emptied', () => {
      service.saveChatDraftV2('room-1', { textInput: 'First', replyToId: 'message-1' });

      service.saveChatDraft('room-1', '');

      expect(service.loadChatDraftV2('room-1')).toEqual({ replyToId: 'message-1' });
    });

    it('stores blank and null fields as absent', () => {
      service.saveChatDraftV2('room-1', {
        textInput: 'Hello',
        replyToId: null,
        originalText: '   ',
        correctedText: '',
        explanationText: undefined,
      });

      const record = stored(chatKey('test-user-1', 'room-1'));
      expect(Object.keys(record ?? {}).sort()).toEqual(['savedAt', 'textInput']);
    });

    it('removes the record when every field is blank', () => {
      service.saveChatDraftV2('room-1', { textInput: 'Hello' });
      service.saveChatDraftV2('room-1', { textInput: '  ', replyToId: null });

      expect(localStorage.getItem(chatKey('test-user-1', 'room-1'))).toBeNull();
    });

    it('writes a single record per room', () => {
      service.saveChatDraft('room-1', 'Hello');
      service.saveChatDraftV2('room-1', { textInput: 'Hello again' });

      expect(localStorage.length).toBe(1);
      expect(localStorage.getItem(rawChatKey('test-user-1', 'room-1'))).toBeNull();
    });

    it('clears the record together with a raw-text copy left by an earlier version', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Hello' });
      seed(rawChatKey('test-user-1', 'room-1'), 'Hello');

      service.clearChatDraftV2('room-1');

      expect(localStorage.length).toBe(0);
    });

    it('ignores room identifiers that are empty or too long', () => {
      service.saveChatDraftV2('', { textInput: 'Hello' });
      service.saveChatDraftV2('r'.repeat(161), { textInput: 'Hello' });

      expect(localStorage.length).toBe(0);
    });

    it('ignores stored fields of the wrong type and removes a record with nothing usable', () => {
      const key = chatKey('test-user-1', 'room-1');
      seed(key, { textInput: 42, replyToId: { id: 'message-1' }, originalText: ['a'], savedAt: NOW });

      expect(service.loadChatDraftV2('room-1')).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    });

    it('drops a reply identifier that is too long but keeps the rest of the draft', () => {
      service.saveChatDraftV2('room-1', { textInput: 'Hello', replyToId: 'm'.repeat(161) });

      expect(service.loadChatDraftV2('room-1')).toEqual({ textInput: 'Hello' });
    });
  });

  describe('moment drafts', () => {
    it('saves and loads a moment draft', () => {
      service.saveMomentDraft({ text: 'My moment', targetLanguage: 'fr' });
      const draft = service.loadMomentDraft();
      expect(draft).toEqual({
        text: 'My moment',
        mediaUrls: undefined,
        mediaType: undefined,
        targetLanguage: 'fr',
        voiceDurationSec: undefined,
      });
    });

    it('returns null for a non-existent moment draft', () => {
      expect(service.loadMomentDraft()).toBeNull();
    });

    it('clears a moment draft when saving empty content', () => {
      service.saveMomentDraft({ text: 'Hello' });
      service.saveMomentDraft({ text: '', mediaUrls: [], mediaType: 'none' });
      expect(service.loadMomentDraft()).toBeNull();
    });

    it('clears a moment draft explicitly', () => {
      service.saveMomentDraft({ text: 'Hello' });
      service.clearMomentDraft();
      expect(service.loadMomentDraft()).toBeNull();
    });

    it('saves bounded media draft fields', () => {
      service.saveMomentDraft({
        text: 'Voice post',
        mediaUrls: ['https://example.com/audio.mp3'],
        mediaType: 'audio',
        targetLanguage: 'ja',
        voiceDurationSec: 42,
      });

      expect(service.loadMomentDraft()).toEqual({
        text: 'Voice post',
        mediaUrls: ['https://example.com/audio.mp3'],
        mediaType: 'audio',
        targetLanguage: 'ja',
        voiceDurationSec: 42,
      });
    });

    it('filters unsafe and excessive media URLs before persistence', () => {
      service.saveMomentDraft({
        text: 'Images',
        mediaUrls: [
          'javascript:alert(1)',
          ...Array.from({ length: 12 }, (_, index) => `https://example.com/${index}.jpg`),
        ],
        mediaType: 'images',
      });

      const draft = service.loadMomentDraft();
      expect(draft?.mediaUrls).toHaveLength(9);
      expect(draft?.mediaUrls?.every((url) => url.startsWith('https://'))).toBe(true);
    });

    it('drops corrupt moment JSON so it cannot poison future loads', () => {
      const key = 'ht_test-user-1_draft_moment';
      localStorage.setItem(key, '["unexpected"]');

      expect(service.loadMomentDraft()).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    });

    it('rejects an out-of-range voice duration without rejecting the rest of the draft', () => {
      service.saveMomentDraft({
        text: 'Voice post',
        mediaUrls: ['https://example.com/audio.mp3'],
        mediaType: 'audio',
        voiceDurationSec: 600,
      });

      expect(service.loadMomentDraft()).toEqual({
        text: 'Voice post',
        mediaUrls: ['https://example.com/audio.mp3'],
        mediaType: 'audio',
        targetLanguage: undefined,
        voiceDurationSec: undefined,
      });
    });

    it('does not keep a record that holds only settings', () => {
      service.saveMomentDraft({ targetLanguage: 'ja', mediaType: 'images', voiceDurationSec: 3 });

      expect(localStorage.length).toBe(0);
    });

    it('removes a stored record that holds nothing worth restoring', () => {
      const key = momentKey('test-user-1');
      seed(key, { targetLanguage: 'ja', mediaType: 'images', savedAt: NOW });

      expect(service.loadMomentDraft()).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    });
  });

  describe('retention', () => {
    it('stamps every record with the time it was saved', () => {
      service.saveChatDraftV2('room-1', { textInput: 'Hello' });
      service.saveMomentDraft({ text: 'Moment' });

      expect(stored(chatKey('test-user-1', 'room-1'))?.['savedAt']).toBe(NOW);
      expect(stored(momentKey('test-user-1'))?.['savedAt']).toBe(NOW);
    });

    it('restarts the retention window each time a draft is saved', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Old', savedAt: NOW - 20 * DAY_MS });

      service.saveChatDraftV2('room-1', { textInput: 'Edited' });

      expect(stored(chatKey('test-user-1', 'room-1'))?.['savedAt']).toBe(NOW);
    });

    it('discards a chat draft that was last saved more than 30 days ago', () => {
      service.loadMomentDraft(); // the one-off clean-up has already run
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Stale', savedAt: NOW - 31 * DAY_MS });
      seed(rawChatKey('test-user-1', 'room-1'), 'Stale');

      expect(service.loadChatDraftV2('room-1')).toBeNull();
      expect(service.loadChatDraft('room-1')).toBe('');
      expect(localStorage.length).toBe(0);
    });

    it('keeps a chat draft that was saved inside the retention window', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Recent', savedAt: NOW - 29 * DAY_MS });

      expect(service.loadChatDraftV2('room-1')).toEqual({ textInput: 'Recent' });
    });

    it('discards an expired Moment draft and keeps a recent one', () => {
      service.loadChatDraftV2('room-1'); // the one-off clean-up has already run
      seed(momentKey('test-user-1'), { text: 'Stale', savedAt: NOW - 45 * DAY_MS });
      expect(service.loadMomentDraft()).toBeNull();
      expect(localStorage.getItem(momentKey('test-user-1'))).toBeNull();

      service.saveMomentDraft({ text: 'Fresh' });
      expect(service.loadMomentDraft()?.text).toBe('Fresh');
    });

    it('still restores records written before timestamps existed', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Written by an older client' });
      seed(momentKey('test-user-1'), { text: 'Older Moment' });

      expect(service.loadChatDraftV2('room-1')).toEqual({ textInput: 'Written by an older client' });
      expect(service.loadMomentDraft()?.text).toBe('Older Moment');
    });

    it('ignores a timestamp that is not a finite number', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Odd', savedAt: 'yesterday' });

      expect(service.loadChatDraftV2('room-1')).toEqual({ textInput: 'Odd' });
    });
  });

  describe('clean-up of stored drafts', () => {
    it('removes expired drafts of every account but keeps fresh drafts and unrelated keys', () => {
      seed(chatKey('other-user', 'room-9'), { textInput: 'Stale', savedAt: NOW - 40 * DAY_MS });
      seed(momentKey('third-user'), { text: 'Stale', savedAt: NOW - 40 * DAY_MS });
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Fresh', savedAt: NOW - DAY_MS });
      seed('theme', 'dark');
      seed('elgl:tr:hello:ja', '{"value":"こんにちは"}');
      seed('ht_test-user-1_unrelated_draft_note', 'keep');
      seed('ht_test-user-1_draft_moment_extra', '{"savedAt":1}');

      service.loadMomentDraft();

      expect(localStorage.getItem(chatKey('other-user', 'room-9'))).toBeNull();
      expect(localStorage.getItem(momentKey('third-user'))).toBeNull();
      expect(stored(chatKey('test-user-1', 'room-1'))?.['textInput']).toBe('Fresh');
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(localStorage.getItem('elgl:tr:hello:ja')).not.toBeNull();
      expect(localStorage.getItem('ht_test-user-1_unrelated_draft_note')).toBe('keep');
      expect(localStorage.getItem('ht_test-user-1_draft_moment_extra')).toBe('{"savedAt":1}');
    });

    it('stamps records without a timestamp so they eventually expire', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Older client' });
      seed(momentKey('other-user'), { text: 'Older client' });

      service.loadMomentDraft();

      expect(stored(chatKey('test-user-1', 'room-1'))).toEqual({
        textInput: 'Older client',
        savedAt: NOW,
      });
      expect(stored(momentKey('other-user'))?.['savedAt']).toBe(NOW);
    });

    it('removes unreadable records left by any account', () => {
      seed(chatKey('other-user', 'room-9'), '{not-json');
      seed(momentKey('third-user'), '["unexpected"]');

      service.loadMomentDraft();

      expect(localStorage.length).toBe(0);
    });

    it('migrates a raw-text chat draft left by an earlier version into a stamped record', () => {
      seed(rawChatKey('test-user-1', 'room-1'), 'Typed before the upgrade');

      expect(service.loadChatDraft('room-1')).toBe('Typed before the upgrade');

      expect(localStorage.getItem(rawChatKey('test-user-1', 'room-1'))).toBeNull();
      expect(stored(chatKey('test-user-1', 'room-1'))).toEqual({
        textInput: 'Typed before the upgrade',
        savedAt: NOW,
      });
    });

    it('prefers the current record over a raw-text copy and removes the copy', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Current', savedAt: NOW - DAY_MS });
      seed(rawChatKey('test-user-1', 'room-1'), 'Shadowed');

      expect(service.loadChatDraft('room-1')).toBe('Current');
      expect(localStorage.getItem(rawChatKey('test-user-1', 'room-1'))).toBeNull();
    });

    it('removes a raw-text copy that is blank or oversized instead of migrating it', () => {
      seed(rawChatKey('test-user-1', 'room-1'), '   ');
      seed(rawChatKey('test-user-1', 'room-2'), 'x'.repeat(10_001));

      service.loadMomentDraft();

      expect(localStorage.length).toBe(0);
    });

    it('keeps the raw-text copy when it could not be migrated', () => {
      seed(rawChatKey('test-user-1', 'room-1'), 'Do not lose me');
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      expect(service.loadChatDraft('room-1')).toBe('Do not lose me');
      expect(localStorage.getItem(rawChatKey('test-user-1', 'room-1'))).toBe('Do not lose me');
    });

    it('also retires the raw-text copy of an expired record', () => {
      seed(chatKey('test-user-1', 'room-1'), { textInput: 'Stale', savedAt: NOW - 40 * DAY_MS });
      seed(rawChatKey('test-user-1', 'room-1'), 'Stale');

      service.loadMomentDraft();

      expect(localStorage.length).toBe(0);
    });

    it('runs once per service instance', () => {
      service.loadMomentDraft();
      seed(momentKey('other-user'), { text: 'Stale', savedAt: NOW - 40 * DAY_MS });

      service.loadMomentDraft();

      expect(localStorage.getItem(momentKey('other-user'))).not.toBeNull();
    });

    it('carries on when the stored keys cannot be listed', () => {
      seed(chatKey('other-user', 'room-9'), { textInput: 'Elsewhere', savedAt: NOW });
      vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });

      expect(() => service.saveChatDraft('room-1', 'Still works')).not.toThrow();
      expect(service.loadChatDraft('room-1')).toBe('Still works');
    });
  });

  describe('storage boundaries', () => {
    it('uses user ID in storage keys to isolate accounts on a shared browser', () => {
      service.saveChatDraft('room-1', 'User 1 draft');

      mockAuth.currentUser = () => ({ id: 'test-user-2' });
      expect(service.loadChatDraft('room-1')).toBe('');

      mockAuth.currentUser = () => ({ id: 'test-user-1' });
      expect(service.loadChatDraft('room-1')).toBe('User 1 draft');
    });

    it('keeps the legacy anonymous namespace when no user is available', () => {
      mockAuth.currentUser = () => null;
      service.saveChatDraft('room-1', 'anon draft');
      expect(service.loadChatDraft('room-1')).toBe('anon draft');
    });

    it('does not break composing when localStorage writes fail', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      expect(() => service.saveChatDraft('room-1', 'still editable')).not.toThrow();
      expect(() => service.saveMomentDraft({ text: 'still editable' })).not.toThrow();
    });

    it('fails closed when localStorage reads are blocked', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });

      expect(service.loadChatDraft('room-1')).toBe('');
      expect(service.loadChatDraftV2('room-1')).toBeNull();
      expect(service.loadMomentDraft()).toBeNull();
    });

    it('does not throw when storage cleanup is blocked', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });

      expect(() => service.clearChatDraft('room-1')).not.toThrow();
      expect(() => service.clearChatDraftV2('room-1')).not.toThrow();
      expect(() => service.clearMomentDraft()).not.toThrow();
    });

    it('does nothing when localStorage does not exist', () => {
      vi.stubGlobal('localStorage', undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(() => service.saveChatDraft('room-1', 'server rendered')).not.toThrow();
      expect(service.loadChatDraft('room-1')).toBe('');
      expect(service.loadMomentDraft()).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it('discards a stored record larger than the serialised limit', () => {
      const key = chatKey('test-user-1', 'room-1');
      seed(key, JSON.stringify({ textInput: 'x'.repeat(96_001) }));

      expect(service.loadChatDraftV2('room-1')).toBeNull();
      expect(localStorage.getItem(key)).toBeNull();
    });
  });

  describe('failure reporting', () => {
    it('reports a failed write once, without draft content or identifiers', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      service.saveChatDraft('room-1', 'my private words');
      service.saveChatDraft('room-1', 'my private words again');
      service.saveMomentDraft({ text: 'my private moment' });

      expect(warn).toHaveBeenCalledTimes(1);
      const reported = JSON.stringify(warn.mock.calls);
      expect(reported).toContain('QuotaExceededError');
      expect(reported).not.toContain('private');
      expect(reported).not.toContain('test-user-1');
      expect(reported).not.toContain('room-1');
    });

    it('falls back to a generic reason when the failure is not an error object', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw 'secret draft text leaked through the exception';
      });

      service.saveChatDraft('room-1', 'text');

      const reported = JSON.stringify(warn.mock.calls);
      expect(reported).toContain('UnknownError');
      expect(reported).not.toContain('secret');
    });

    it('does not report a failed read or clean-up', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });

      service.loadChatDraft('room-1');
      service.clearChatDraft('room-1');

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
