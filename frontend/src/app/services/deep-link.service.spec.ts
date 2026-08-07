import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DOCUMENT, Location } from '@angular/common';
import { DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  let service: DeepLinkService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DeepLinkService,
        provideRouter([]),
        Location,
        { provide: DOCUMENT, useValue: document },
      ],
    });
    service = TestBed.inject(DeepLinkService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  describe('handleDeepLink', () => {
    it('returns true and navigates for valid hellotalk://profile/:id URIs', () => {
      expect(service.handleDeepLink('hellotalk://profile/user-abc')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/user-abc');
    });

    it('returns true and navigates for profile URIs with trailing slash', () => {
      expect(service.handleDeepLink('hellotalk://profile/user-abc/')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/user-abc');
    });

    it('returns false for profile URIs with empty path', () => {
      expect(service.handleDeepLink('hellotalk://profile')).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('returns false for profile URIs with only a slash', () => {
      expect(service.handleDeepLink('hellotalk://profile/')).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('returns false for unknown hosts', () => {
      expect(service.handleDeepLink('hellotalk://unknown/123')).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('returns false for non-hellotalk URIs', () => {
      expect(service.handleDeepLink('https://example.com/profile/123')).toBe(false);
      expect(service.handleDeepLink('otherscheme://profile/123')).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('returns false for empty or malformed input', () => {
      expect(service.handleDeepLink('')).toBe(false);
      expect(service.handleDeepLink('not-a-uri')).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('handles profile ID with special characters', () => {
      expect(service.handleDeepLink('hellotalk://profile/user-id-with-hyphens')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/user-id-with-hyphens');
    });

    it('handles chat URIs', () => {
      expect(service.handleDeepLink('hellotalk://chat/room-456')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/chat/room-456');
    });

    it('handles simple path URIs without params', () => {
      expect(service.handleDeepLink('hellotalk://moments')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/moments');
      expect(service.handleDeepLink('hellotalk://discovery')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/discovery');
      expect(service.handleDeepLink('hellotalk://settings')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/settings');
      expect(service.handleDeepLink('hellotalk://vip')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/vip');
      expect(service.handleDeepLink('hellotalk://milestones')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/milestones');
      expect(service.handleDeepLink('hellotalk://study-buddy')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/study-buddy');
      expect(service.handleDeepLink('hellotalk://lessons')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/lessons');
      expect(service.handleDeepLink('hellotalk://vocabulary')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/vocabulary');
      expect(service.handleDeepLink('hellotalk://leaderboard')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/leaderboard');
      expect(service.handleDeepLink('hellotalk://favourites')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/favourites');
      expect(service.handleDeepLink('hellotalk://help')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/help');
      expect(service.handleDeepLink('hellotalk://home')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
    });

    it('handles events with and without id', () => {
      expect(service.handleDeepLink('hellotalk://events/evt-789')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/events/evt-789');
      expect(service.handleDeepLink('hellotalk://events')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/events');
    });

    it('handles groups with and without id', () => {
      expect(service.handleDeepLink('hellotalk://groups/grp-001')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/groups/grp-001');
      expect(service.handleDeepLink('hellotalk://groups')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/groups');
    });

    it('handles audio-rooms with and without id', () => {
      expect(service.handleDeepLink('hellotalk://audio-rooms/room-1')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/audio-rooms/room-1');
      expect(service.handleDeepLink('hellotalk://audio-rooms')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/audio-rooms');
    });

    it('handles URIs with query parameters', () => {
      expect(service.handleDeepLink('hellotalk://profile/123?ref=notification')).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/123?ref=notification');
    });

    it('returns false for chat with empty path', () => {
      expect(service.handleDeepLink('hellotalk://chat')).toBe(false);
      expect(service.handleDeepLink('hellotalk://chat/')).toBe(false);
    });
  });

  describe('toInternalPath', () => {
    it('returns the correct internal path for profile', () => {
      const result = service.toInternalPath({ host: 'profile', path: '/abc', params: {} });
      expect(result).toBe('/profile/abc');
    });

    it('returns null for profile without id', () => {
      const result = service.toInternalPath({ host: 'profile', path: '', params: {} });
      expect(result).toBeNull();
    });

    it('preserves query parameters', () => {
      const result = service.toInternalPath({
        host: 'profile',
        path: '/abc',
        params: { ref: 'notification', src: 'email' },
      });
      expect(result).toBe('/profile/abc?ref=notification&src=email');
    });
  });

  describe('processInitialDeepLink', () => {
    it('does not throw when document is available', () => {
      expect(() => service.processInitialDeepLink()).not.toThrow();
    });
  });

  describe('registerRuntimeListener', () => {
    it('does not throw when called', () => {
      expect(() => service.registerRuntimeListener()).not.toThrow();
    });

    it('does not add listeners twice', () => {
      service.registerRuntimeListener();
      service.registerRuntimeListener();
      // Should not throw or cause side effects
    });
  });
});