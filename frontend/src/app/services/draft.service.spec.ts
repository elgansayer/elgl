import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

    it('returns empty string for non-existent draft', () => {
      expect(service.loadChatDraft('room-999')).toBe('');
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

    it('persists and restores enriched chat draft state', () => {
      service.saveChatDraftV2('room-1', {
        textInput: 'Replying now',
        replyToId: 'message-7',
        originalText: 'helo',
        correctedText: 'hello',
        explanationText: 'Spelling correction',
      });

      expect(service.loadChatDraftV2('room-1')).toEqual({
        textInput: 'Replying now',
        replyToId: 'message-7',
        originalText: 'helo',
        correctedText: 'hello',
        explanationText: 'Spelling correction',
      });
    });
  });

  describe('moment drafts', () => {
    it('saves and loads a moment draft', () => {
      service.saveMomentDraft({ text: 'My moment', targetLanguage: 'fr' });
      const draft = service.loadMomentDraft();
      expect(draft).toEqual({ text: 'My moment', targetLanguage: 'fr' });
    });

    it('returns null for non-existent moment draft', () => {
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

    it('saves media draft fields', () => {
      service.saveMomentDraft({
        text: 'Voice post',
        mediaUrls: ['https://example.com/audio.mp3'],
        mediaType: 'audio',
        targetLanguage: 'ja',
      });
      const draft = service.loadMomentDraft();
      expect(draft).toEqual({
        text: 'Voice post',
        mediaUrls: ['https://example.com/audio.mp3'],
        mediaType: 'audio',
        targetLanguage: 'ja',
      });
    });

    it('ignores malformed persisted JSON', () => {
      localStorage.setItem('ht_test-user-1_draft_moment', '{not-json');
      expect(service.loadMomentDraft()).toBeNull();
    });
  });

  describe('storage failures', () => {
    it('does not interrupt composing when storage writes fail', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      expect(() => service.saveChatDraft('room-1', 'Keep typing')).not.toThrow();
      expect(() => service.saveMomentDraft({ text: 'Keep composing' })).not.toThrow();
    });

    it('returns safe empty values when storage reads fail', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Storage blocked', 'SecurityError');
      });

      expect(service.loadChatDraft('room-1')).toBe('');
      expect(service.loadChatDraftV2('room-1')).toBeNull();
      expect(service.loadMomentDraft()).toBeNull();
    });

    it('does not interrupt successful sends when storage cleanup fails', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Storage blocked', 'SecurityError');
      });

      expect(() => service.clearChatDraft('room-1')).not.toThrow();
      expect(() => service.clearChatDraftV2('room-1')).not.toThrow();
      expect(() => service.clearMomentDraft()).not.toThrow();
    });
  });

  describe('user-scoped keys', () => {
    it('uses user ID in storage key', () => {
      service.saveChatDraft('room-1', 'User 1 draft');

      mockAuth.currentUser = () => ({ id: 'test-user-2' });
      expect(service.loadChatDraft('room-1')).toBe('');
    });

    it('uses anon prefix when no user', () => {
      mockAuth.currentUser = () => null;
      service.saveChatDraft('room-1', 'anon draft');
      expect(service.loadChatDraft('room-1')).toBe('anon draft');
    });
  });
});
