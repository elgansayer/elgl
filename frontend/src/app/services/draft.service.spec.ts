import { describe, it, expect, beforeEach } from 'vitest';
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
  });

  describe('user-scoped keys', () => {
    it('uses user ID in storage key', () => {
      service.saveChatDraft('room-1', 'User 1 draft');

      // Switch to a different user
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
