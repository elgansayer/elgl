import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { UserService, UserProfile } from './user.service';
import { environment } from '../../environments/environment';

class AuthServiceStub {
  getAccessToken(): string | undefined {
    return 'test-token';
  }
}

/**
 * Settings > Appearance saves the entitlement-gated primary accent through the
 * authenticated profile PATCH. `updateMyProfile` must reject whenever the
 * server refuses or loses the write, so a rejected change can never be
 * reported to the user as saved.
 */
describe('UserService profile update', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/users`;

  function createProfile(partial: Partial<UserProfile> = {}): UserProfile {
    return {
      id: 'u-1',
      native_languages: ['en'],
      target_languages: ['fr'],
      is_vip: true,
      vip_tier: 'gold',
      coins_balance: 100,
      study_streak_days: 3,
      correction_ratio: 0,
      is_serious_learner: false,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      privacy_hide_gender: false,
      created_at: '2024-01-01T00:00:00Z',
      ...partial,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService,
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  describe('updateMyProfile', () => {
    it('should PATCH /users/me with the update and return the confirmed profile', async () => {
      const update = { primary_accent_color: '#1A8478' };
      const confirmed = createProfile({ primary_accent_color: '#1A8478' });
      const resultPromise = service.updateMyProfile(update);

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(update);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(confirmed);

      expect(await resultPromise).toEqual(confirmed);
    });

    it('should reject when the server refuses the change', async () => {
      const resultPromise = service.updateMyProfile({
        primary_accent_color: '#1A8478',
      });

      httpMock
        .expectOne(`${baseUrl}/me`)
        .flush(
          { message: 'Custom primary accent colours require a VIP subscription' },
          { status: 400, statusText: 'Bad Request' },
        );

      await expect(resultPromise).rejects.toMatchObject({ status: 400 });
    });

    it('should reject on a network failure', async () => {
      const resultPromise = service.updateMyProfile({ bio_text: 'New bio' });

      httpMock.expectOne(`${baseUrl}/me`).error(new ProgressEvent('error'));

      await expect(resultPromise).rejects.toBeTruthy();
    });

    it('should reject when the server fails the request', async () => {
      const resultPromise = service.updateMyProfile({ bio_text: 'New bio' });

      httpMock
        .expectOne(`${baseUrl}/me`)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

      await expect(resultPromise).rejects.toBeTruthy();
    });
  });
});
