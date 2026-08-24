import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DraftService } from './draft.service';
import { AuthService } from './auth.service';

describe('DraftService', () => {
  let service: DraftService;
  let mockAuth: { currentUser: () => { id: string } | null };

  beforeEach(() => {
    localStorage.clear();
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
  });
});
