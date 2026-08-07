import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  let service: DeepLinkService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DeepLinkService, provideRouter([])],
    });
    service = TestBed.inject(DeepLinkService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  describe('handleDeepLink', () => {
    it('returns true and navigates for valid hellotalk://profile/:id URIs', () => {
      expect(service.handleDeepLink('hellotalk://profile/user-abc')).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/profile', 'user-abc']);
    });

    it('returns true and navigates for profile URIs with trailing slash', () => {
      expect(service.handleDeepLink('hellotalk://profile/user-abc/')).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/profile', 'user-abc']);
    });

    it('returns false for profile URIs with empty path', () => {
      expect(service.handleDeepLink('hellotalk://profile')).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('returns false for profile URIs with only a slash', () => {
      expect(service.handleDeepLink('hellotalk://profile/')).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('returns false for unknown hosts', () => {
      expect(service.handleDeepLink('hellotalk://unknown/123')).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('returns false for non-hellotalk URIs', () => {
      expect(service.handleDeepLink('https://example.com/profile/123')).toBe(false);
      expect(service.handleDeepLink('otherscheme://profile/123')).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('returns false for empty or malformed input', () => {
      expect(service.handleDeepLink('')).toBe(false);
      expect(service.handleDeepLink('not-a-uri')).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('handles profile ID with special characters', () => {
      expect(service.handleDeepLink('hellotalk://profile/user-id-with-hyphens')).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith([
        '/profile',
        'user-id-with-hyphens',
      ]);
    });
  });
});