import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import {
  UserService,
  UserProfile,
  ProfileVisitor,
} from './user.service';
import { environment } from '../../environments/environment';
import { MOCK_USER_PROFILE, MOCK_VISITORS } from './mock-data';

class AuthServiceStub {
  getAccessToken(): string | null {
    return 'test-token';
  }
}

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/users`;
  const visitsUrl = `${environment.apiUrl}/profile-visits`;

  function createProfile(partial: Partial<UserProfile> = {}): UserProfile {
    return {
      id: 'u-1',
      native_languages: ['en'],
      target_languages: ['fr'],
      is_vip: false,
      vip_tier: 'free',
      coins_balance: 100,
      study_streak_days: 3,
      correction_ratio: 0,
      is_serious_learner: true,
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

  describe('subscribeToFcmTopic', () => {
    it('should POST to the FCM topic subscription endpoint', async () => {
      const topic = 'test-topic';
      const resultPromise = service.subscribeToFcmTopic(topic);

      const req = httpMock.expectOne(`${baseUrl}/fcm/subscribe`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ topic });
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ success: true });

      expect(await resultPromise).toEqual({ success: true });
    });

    it('should handle errors gracefully when subscribing to a topic', async () => {
      const topic = 'test-topic';
      const resultPromise = service.subscribeToFcmTopic(topic);

      const req = httpMock.expectOne(`${baseUrl}/fcm/subscribe`);
      req.flush('error', { status: 500, statusText: 'Internal Server Error' });

      await expect(resultPromise).rejects.toThrow('Failed to subscribe to topic');
    });
  });


  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMyProfile', () => {
    it('should GET /users/me and return the profile', async () => {
      const profile = createProfile({ id: 'me' });
      const resultPromise = service.getMyProfile();

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(profile);

      expect(await resultPromise).toEqual(profile);
    });

    it('should fall back to local mock data when the request fails', async () => {
      const resultPromise = service.getMyProfile();

      const req = httpMock.expectOne(`${baseUrl}/me`);
      req.flush('Server error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await resultPromise;
      expect(result).not.toBeNull();
      expect(result?.status_text).toBe('Learning new languages!');
      expect(result?.chat_enter_to_send).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('should GET /users/:id and return the profile', async () => {
      const profile = createProfile({ id: 'other' });
      const resultPromise = service.getUserProfile('other');

      const req = httpMock.expectOne(`${baseUrl}/other`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(profile);

      expect(await resultPromise).toEqual(profile);
    });

    it('should return a mock user when the profile exists in mock data and request fails', async () => {
      const mockId = MOCK_USER_PROFILE.id;
      const resultPromise = service.getUserProfile(mockId);

      const req = httpMock.expectOne(`${baseUrl}/${mockId}`);
      req.flush('error', { status: 404, statusText: 'Not Found' });

      const result = await resultPromise;
      expect(result).toEqual(MOCK_USER_PROFILE);
    });

    it('should return null when the profile is not in mock data and request fails', async () => {
      const resultPromise = service.getUserProfile('nonexistent-id');

      const req = httpMock.expectOne(`${baseUrl}/nonexistent-id`);
      req.flush('error', { status: 404, statusText: 'Not Found' });

      expect(await resultPromise).toBeNull();
    });
  });

  describe('getFollowers', () => {
    it('should GET /users/:id/followers with paging params and return the list', async () => {
      const profile = createProfile({ id: 'follower-1' });
      const resultPromise = service.getFollowers('user-1', 20, 0);

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/user-1/followers`,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('offset')).toBe('0');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ data: [profile], total: 1 });

      expect(await resultPromise).toEqual({ data: [profile], total: 1 });
    });

    it('should return an empty list when the request fails', async () => {
      const resultPromise = service.getFollowers('user-1');

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/user-1/followers`,
      );
      req.flush('error', { status: 500, statusText: 'Internal Server Error' });

      expect(await resultPromise).toEqual({ data: [], total: 0 });
    });
  });

  describe('getFollowing', () => {
    it('should GET /users/:id/following with paging params and return the list', async () => {
      const profile = createProfile({ id: 'following-1' });
      const resultPromise = service.getFollowing('user-1', 10, 5);

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/user-1/following`,
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.params.get('offset')).toBe('5');
      req.flush({ data: [profile], total: 1 });

      expect(await resultPromise).toEqual({ data: [profile], total: 1 });
    });

    it('should return an empty list when the request fails', async () => {
      const resultPromise = service.getFollowing('user-1');

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/user-1/following`,
      );
      req.flush('error', { status: 500, statusText: 'Internal Server Error' });

      expect(await resultPromise).toEqual({ data: [], total: 0 });
    });
  });

  describe('updateMyProfile', () => {
    it('should PATCH /users/me with the update', async () => {
      const update = { native_languages: ['de'] };
      const updatedProfile = createProfile({ native_languages: ['de'] });
      const resultPromise = service.updateMyProfile(update);

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(update);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(updatedProfile);

      expect(await resultPromise).toEqual(updatedProfile);
    });

    it('should fall back to mock data on error', async () => {
      const update = { bio_text: 'New bio' };
      const resultPromise = service.updateMyProfile(update);

      const req = httpMock.expectOne(`${baseUrl}/me`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result).toBeTruthy();
      expect(result?.bio_text).toBe('New bio');
    });
  });

  describe('getProfileVisitors', () => {
    it('should GET /users/me/visitors and return the visitors', async () => {
      const visitors: ProfileVisitor[] = [
        {
          id: 'visit-1',
          visitor_id: 'u-1',
          viewed_id: 'u-2',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const resultPromise = service.getProfileVisitors();

      const req = httpMock.expectOne(`${baseUrl}/me/visitors`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(visitors);

      expect(await resultPromise).toEqual(visitors);
    });

    it('should fall back to MOCK_VISITORS on error', async () => {
      const resultPromise = service.getProfileVisitors();

      const req = httpMock.expectOne(`${baseUrl}/me/visitors`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result).toEqual(MOCK_VISITORS);
    });
  });

  describe('recordVisit', () => {
    it('should POST to the profile-visits endpoint', async () => {
      const viewedUserId = 'viewed-user';
      const resultPromise = service.recordVisit(viewedUserId);

      const req = httpMock.expectOne(`${visitsUrl}/${viewedUserId}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ ok: true });

      const result = await resultPromise;
      expect(result).toBeTruthy();
    });
  });

  describe('getStudyStreak', () => {
    it('should return study_streak_days from the response', async () => {
      const resultPromise = service.getStudyStreak();

      const req = httpMock.expectOne(`${baseUrl}/me/stats`);
      expect(req.request.method).toBe('GET');
      req.flush({ study_streak_days: 42 });

      const result = await resultPromise;
      expect(result).toBe(42);
    });

    it('should return 0 when the stats endpoint fails', async () => {
      const resultPromise = service.getStudyStreak();

      const req = httpMock.expectOne(`${baseUrl}/me/stats`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result).toBe(0);
    });
  });

  describe('getMilestoneForStreak', () => {
    it('should return the milestone for known streak values', () => {
      expect(service.getMilestoneForStreak(100)).toBe(100);
      expect(service.getMilestoneForStreak(30)).toBe(30);
      expect(service.getMilestoneForStreak(7)).toBe(7);
    });

    it('should return null for a streak below 7 days', () => {
      expect(service.getMilestoneForStreak(6)).toBeNull();
    });
  });

  describe('getOnlineStatus', () => {
    it('should return online for activity within the last five minutes', () => {
      const recent = new Date(Date.now() - 4 * 60 * 1000).toISOString();
      expect(service.getOnlineStatus({ last_active_at: recent })).toBe('online');
    });

    it('should return recently for activity within the last day', () => {
      const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(service.getOnlineStatus({ last_active_at: recent })).toBe(
        'recently',
      );
    });

    it('should return offline when last_active_at is undefined', () => {
      expect(service.getOnlineStatus({ last_active_at: undefined })).toBe(
        'offline',
      );
    });

    it('should return offline for activity older than one day', () => {
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(service.getOnlineStatus({ last_active_at: old })).toBe('offline');
    });
  });

  describe('getLastActiveFormatted', () => {
    it('should format last_active_at when present', () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const result = service.getLastActiveFormatted({
        last_active_at: date.toISOString(),
      });
      expect(result).toBe(date.toLocaleString());
    });

    it('should return null when last_active_at is missing', () => {
      expect(
        service.getLastActiveFormatted({ last_active_at: undefined }),
      ).toBeNull();
    });
  });

  describe('followUser', () => {
    it('should POST to /users/:id/follow', async () => {
      const resultPromise = service.followUser('user-1');

      const req = httpMock.expectOne(`${baseUrl}/user-1/follow`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.has('Authorization')).toBe(true);
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const resultPromise = service.followUser('user-1');

      const req = httpMock.expectOne(`${baseUrl}/user-1/follow`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('unfollowUser', () => {
    it('should DELETE /users/:id/follow', async () => {
      const resultPromise = service.unfollowUser('user-1');

      const req = httpMock.expectOne(`${baseUrl}/user-1/follow`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const resultPromise = service.unfollowUser('user-1');

      const req = httpMock.expectOne(`${baseUrl}/user-1/follow`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('likeProfile', () => {
    it('should POST to /users/:id/like', async () => {
      const resultPromise = service.likeProfile('user-2');

      const req = httpMock.expectOne(`${baseUrl}/user-2/like`);
      expect(req.request.method).toBe('POST');
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const resultPromise = service.likeProfile('user-2');

      const req = httpMock.expectOne(`${baseUrl}/user-2/like`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('setDefaultTranslationLanguage', () => {
    it('should delegate to updateMyProfile with the language', async () => {
      const resultPromise = service.setDefaultTranslationLanguage('fr');

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.body).toEqual({ default_translation_language: 'fr' });
      req.flush(createProfile({ default_translation_language: 'fr' }));

      const result = await resultPromise;
      expect(result?.default_translation_language).toBe('fr');
    });
  });

  describe('updateNativeLanguages', () => {
    it('should delegate to updateMyProfile with native languages', async () => {
      const resultPromise = service.updateNativeLanguages(['de', 'en']);

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.body).toEqual({ native_languages: ['de', 'en'] });
      req.flush(createProfile({ native_languages: ['de', 'en'] }));

      const result = await resultPromise;
      expect(result?.native_languages).toEqual(['de', 'en']);
    });
  });

  describe('updateTargetLanguages', () => {
    it('should delegate to updateMyProfile with target languages', async () => {
      const resultPromise = service.updateTargetLanguages(['ja']);

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.body).toEqual({ target_languages: ['ja'] });
      req.flush(createProfile({ target_languages: ['ja'] }));

      const result = await resultPromise;
      expect(result?.target_languages).toEqual(['ja']);
    });
  });

  describe('getMyVisitors', () => {
    it('should GET /profile-visits/my-visitors', async () => {
      const visitsUrl = `${environment.apiUrl}/profile-visits`;
      const visitors = [
        {
          id: 'v-1',
          created_at: '2024-01-01T00:00:00Z',
          is_blurred: false,
          visitor: {
            id: 'u-1',
            native_languages: ['en'],
            target_languages: ['fr'],
          },
        },
      ];
      const resultPromise = service.getMyVisitors();

      const req = httpMock.expectOne(`${visitsUrl}/my-visitors`);
      expect(req.request.method).toBe('GET');
      req.flush(visitors);

      await expect(resultPromise).resolves.toEqual(visitors);
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should POST to /media/presigned-url', async () => {
      const mediaUrl = `${environment.apiUrl}/media`;
      const responseData = {
        uploadUrl: 'https://r2.example.com/upload',
        mediaUrl: 'https://r2.example.com/file.jpg',
        objectKey: 'uploads/file.jpg',
      };
      const resultPromise = service.getPresignedUploadUrl('file.jpg', 'image/jpeg', 'uploads');

      const req = httpMock.expectOne(`${mediaUrl}/presigned-url`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ filename: 'file.jpg', contentType: 'image/jpeg', folder: 'uploads' });
      req.flush(responseData);

      await expect(resultPromise).resolves.toEqual(responseData);
    });
  });

  describe('getPresignedCoverPhotoUrl', () => {
    it('should POST to /users/me/cover-photo/presigned-url', async () => {
      const responseData = {
        uploadUrl: 'https://r2.example.com/upload',
        mediaUrl: 'https://r2.example.com/cover.jpg',
        objectKey: 'covers/cover.jpg',
      };
      const resultPromise = service.getPresignedCoverPhotoUrl('cover.jpg', 'image/jpeg');

      const req = httpMock.expectOne(`${baseUrl}/me/cover-photo/presigned-url`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ filename: 'cover.jpg', contentType: 'image/jpeg' });
      req.flush(responseData);

      await expect(resultPromise).resolves.toEqual(responseData);
    });
  });

  describe('getPresignedAvatarUrl', () => {
    it('should POST to /users/me/avatar/presigned-url', async () => {
      const responseData = {
        uploadUrl: 'https://r2.example.com/upload',
        mediaUrl: 'https://r2.example.com/avatar.jpg',
        objectKey: 'avatars/avatar.jpg',
      };
      const resultPromise = service.getPresignedAvatarUrl('avatar.jpg', 'image/jpeg');

      const req = httpMock.expectOne(`${baseUrl}/me/avatar/presigned-url`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ filename: 'avatar.jpg', contentType: 'image/jpeg' });
      req.flush(responseData);

      await expect(resultPromise).resolves.toEqual(responseData);
    });
  });

  describe('updateCoverPhotoUrl', () => {
    it('should PATCH /users/me/cover-photo with the URL', async () => {
      const updatedProfile = createProfile({ cover_photo_url: 'https://r2.example.com/cover.jpg' });
      const resultPromise = service.updateCoverPhotoUrl('https://r2.example.com/cover.jpg');

      const req = httpMock.expectOne(`${baseUrl}/me/cover-photo`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ cover_photo_url: 'https://r2.example.com/cover.jpg' });
      req.flush(updatedProfile);

      await expect(resultPromise).resolves.toEqual(updatedProfile);
    });
  });

  describe('rateCorrector', () => {
    it('should POST to /corrector-score/rate', async () => {
      const correctorUrl = `${environment.apiUrl}/corrector-score/rate`;
      const resultPromise = service.rateCorrector('user-1', 5);

      const req = httpMock.expectOne(correctorUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rated_user_id: 'user-1', score: 5 });
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const correctorUrl = `${environment.apiUrl}/corrector-score/rate`;
      const resultPromise = service.rateCorrector('user-1', 3);

      const req = httpMock.expectOne(correctorUrl);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('getLinkedAccounts', () => {
    it('should GET /users/me/linked-accounts', async () => {
      const accounts = [{ id: 'acc-1', provider: 'google', provider_id: 'g-123', created_at: '2024-01-01T00:00:00Z' }];
      const resultPromise = service.getLinkedAccounts();

      const req = httpMock.expectOne(`${baseUrl}/me/linked-accounts`);
      expect(req.request.method).toBe('GET');
      req.flush(accounts);

      await expect(resultPromise).resolves.toEqual(accounts);
    });

    it('should return an empty array on error', async () => {
      const resultPromise = service.getLinkedAccounts();

      const req = httpMock.expectOne(`${baseUrl}/me/linked-accounts`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toEqual([]);
    });
  });

  describe('getMyPrivacySettings', () => {
    it('should GET /users/me/privacy-settings', async () => {
      const settings = {
        privacy_hide_age: true,
        privacy_hide_location: false,
        privacy_hide_from_search: false,
        privacy_hide_gender: false,
        privacy_hide_exact_location: false,
        privacy_hide_online_status: false,
        privacy_hide_vip_status: false,
      };
      const resultPromise = service.getMyPrivacySettings();

      const req = httpMock.expectOne(`${baseUrl}/me/privacy-settings`);
      expect(req.request.method).toBe('GET');
      req.flush(settings);

      await expect(resultPromise).resolves.toEqual(settings);
    });

    it('should fall back to mock data on error', async () => {
      const resultPromise = service.getMyPrivacySettings();

      const req = httpMock.expectOne(`${baseUrl}/me/privacy-settings`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result).toBeTruthy();
      expect(typeof result.privacy_hide_age).toBe('boolean');
    });
  });

  describe('linkAccount', () => {
    it('should POST to /users/me/linked-accounts/link', async () => {
      const resultPromise = service.linkAccount('google');

      const req = httpMock.expectOne(`${baseUrl}/me/linked-accounts/link`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ provider: 'google' });
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const resultPromise = service.linkAccount('google');

      const req = httpMock.expectOne(`${baseUrl}/me/linked-accounts/link`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('unlinkAccount', () => {
    it('should POST to /users/me/linked-accounts/unlink', async () => {
      const resultPromise = service.unlinkAccount('google');

      const req = httpMock.expectOne(`${baseUrl}/me/linked-accounts/unlink`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ provider: 'google' });
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('getAvailableHobbies', () => {
    it('should GET /users/hobbies', async () => {
      const hobbies = ['reading', 'gaming'];
      const resultPromise = service.getAvailableHobbies();

      const req = httpMock.expectOne(`${baseUrl}/hobbies`);
      expect(req.request.method).toBe('GET');
      req.flush(hobbies);

      await expect(resultPromise).resolves.toEqual(hobbies);
    });

    it('should fall back to built-in list on error', async () => {
      const resultPromise = service.getAvailableHobbies();

      const req = httpMock.expectOne(`${baseUrl}/hobbies`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('reading');
    });
  });

  describe('getAvailableInterests', () => {
    it('should GET /users/interests', async () => {
      const interests = ['technology', 'art'];
      const resultPromise = service.getAvailableInterests();

      const req = httpMock.expectOne(`${baseUrl}/interests`);
      expect(req.request.method).toBe('GET');
      req.flush(interests);

      await expect(resultPromise).resolves.toEqual(interests);
    });

    it('should fall back to built-in list on error', async () => {
      const resultPromise = service.getAvailableInterests();

      const req = httpMock.expectOne(`${baseUrl}/interests`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('technology');
    });
  });

  describe('getMyBadges', () => {
    it('should GET /users/me/badges', async () => {
      const badges = [{ id: 'b-1', badge_type: 'streak', awarded_at: '2024-01-01T00:00:00Z', label: 'Streak' }];
      const resultPromise = service.getMyBadges();

      const req = httpMock.expectOne(`${baseUrl}/me/badges`);
      expect(req.request.method).toBe('GET');
      req.flush(badges);

      await expect(resultPromise).resolves.toEqual(badges);
    });

    it('should return an empty array on error', async () => {
      const resultPromise = service.getMyBadges();

      const req = httpMock.expectOne(`${baseUrl}/me/badges`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toEqual([]);
    });
  });

  describe('assessProficiency', () => {
    it('should POST to /users/me/assess-proficiency and return the level', async () => {
      const resultPromise = service.assessProficiency(85);

      const req = httpMock.expectOne(`${baseUrl}/me/assess-proficiency`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ score: 85 });
      req.flush({ level: 'B2' });

      await expect(resultPromise).resolves.toBe('B2');
    });

    it('should fall back to A1 on error', async () => {
      const resultPromise = service.assessProficiency(10);

      const req = httpMock.expectOne(`${baseUrl}/me/assess-proficiency`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBe('A1');
    });
  });

  describe('getOverviewStats', () => {
    it('should GET /users/stats/me', async () => {
      const stats = { translations_count: 10, corrections_count: 5, moments_count: 3 };
      const resultPromise = service.getOverviewStats();

      const req = httpMock.expectOne(`${baseUrl}/stats/me`);
      expect(req.request.method).toBe('GET');
      req.flush(stats);

      await expect(resultPromise).resolves.toEqual(stats);
    });

    it('should return zeroed stats on error', async () => {
      const resultPromise = service.getOverviewStats();

      const req = httpMock.expectOne(`${baseUrl}/stats/me`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toEqual({
        translations_count: 0,
        corrections_count: 0,
        moments_count: 0,
      });
    });
  });

  describe('getMyXpTotal', () => {
    it('should GET /users/me/xp and return totalXp', async () => {
      const resultPromise = service.getMyXpTotal();

      const req = httpMock.expectOne(`${baseUrl}/me/xp`);
      expect(req.request.method).toBe('GET');
      req.flush({ totalXp: 1500 });

      await expect(resultPromise).resolves.toBe(1500);
    });

    it('should return 0 on error', async () => {
      const resultPromise = service.getMyXpTotal();

      const req = httpMock.expectOne(`${baseUrl}/me/xp`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBe(0);
    });
  });

  describe('updatePrivacySettings', () => {
    it('should PATCH /users/me/privacy with the settings', async () => {
      const settings = { privacy_last_seen: 'contacts', incognito_visits: true };
      const updatedProfile = createProfile();
      const resultPromise = service.updatePrivacySettings(settings);

      const req = httpMock.expectOne(`${baseUrl}/me/privacy`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(settings);
      req.flush(updatedProfile);

      await expect(resultPromise).resolves.toEqual(updatedProfile);
    });

    it('should fall back to mock profile on error', async () => {
      const resultPromise = service.updatePrivacySettings({ incognito_visits: true });

      const req = httpMock.expectOne(`${baseUrl}/me/privacy`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result).toBeTruthy();
      expect(result.id).toBeDefined();
    });
  });

  describe('getBusinessProfile', () => {
    it('should GET /users/me/business', async () => {
      const business = { business_name: 'Acme Corp', website_url: 'https://acme.com' };
      const resultPromise = service.getBusinessProfile();

      const req = httpMock.expectOne(`${baseUrl}/me/business`);
      expect(req.request.method).toBe('GET');
      req.flush(business);

      await expect(resultPromise).resolves.toEqual(business);
    });
  });

  describe('updateBusinessProfile', () => {
    it('should PATCH /users/me/business with the business data', async () => {
      const business = { business_name: 'Acme Corp', website_url: 'https://acme.com' };
      const updatedProfile = createProfile();
      const resultPromise = service.updateBusinessProfile(business);

      const req = httpMock.expectOne(`${baseUrl}/me/business`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(business);
      req.flush(updatedProfile);

      await expect(resultPromise).resolves.toEqual(updatedProfile);
    });
  });

  describe('blockUser', () => {
    it('should POST to /trust-safety/block', async () => {
      const trustUrl = `${environment.apiUrl}/safety/block`;
      const resultPromise = service.blockUser('user-3');

      const req = httpMock.expectOne(trustUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ blocked_id: 'user-3' });
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const trustUrl = `${environment.apiUrl}/safety/block`;
      const resultPromise = service.blockUser('user-3');

      const req = httpMock.expectOne(trustUrl);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('unblockUser', () => {
    it('should DELETE /trust-safety/block/:id', async () => {
      const trustUrl = `${environment.apiUrl}/safety/unblock`;
      const resultPromise = service.unblockUser('user-3');

      const req = httpMock.expectOne(trustUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ blocked_id: 'user-3' });
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const trustUrl = `${environment.apiUrl}/safety/unblock`;
      const resultPromise = service.unblockUser('user-3');

      const req = httpMock.expectOne(trustUrl);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('reportUser', () => {
    it('should POST to /trust-safety/report', async () => {
      const reportUrl = `${environment.apiUrl}/safety/report`;
      const resultPromise = service.reportUser('user-4', 'spam', 'Sending spam', 'https://app/post/1');

      const req = httpMock.expectOne(reportUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        reported_id: 'user-4',
        reason_category: 'spam',
        description: 'Sending spam',
        context_url: 'https://app/post/1',
      });
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const reportUrl = `${environment.apiUrl}/safety/report`;
      const resultPromise = service.reportUser('user-4', 'spam');

      const req = httpMock.expectOne(reportUrl);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('deleteMyAccount', () => {
    it('should DELETE /users/me', async () => {
      const response = { message: 'Account scheduled for deletion', scheduled_for_deletion_at: '2024-02-01T00:00:00Z' };
      const resultPromise = service.deleteMyAccount();

      const req = httpMock.expectOne(`${baseUrl}/me`);
      expect(req.request.method).toBe('DELETE');
      req.flush(response);

      await expect(resultPromise).resolves.toEqual(response);
    });

    it('should return empty strings on error', async () => {
      const resultPromise = service.deleteMyAccount();

      const req = httpMock.expectOne(`${baseUrl}/me`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toEqual({ message: '', scheduled_for_deletion_at: '' });
    });
  });

  describe('restoreMyAccount', () => {
    it('should POST to /users/me/restore', async () => {
      const resultPromise = service.restoreMyAccount();

      const req = httpMock.expectOne(`${baseUrl}/me/restore`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'Account restored' });

      await expect(resultPromise).resolves.toEqual({ message: 'Account restored' });
    });

    it('should return empty message on error', async () => {
      const resultPromise = service.restoreMyAccount();

      const req = httpMock.expectOne(`${baseUrl}/me/restore`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toEqual({ message: '' });
    });
  });

  describe('getMessageFilters', () => {
    it('should GET /users/me/message-filters', async () => {
      const filters = { age_min: 18, age_max: 35, allowed_genders: ['female'] };
      const resultPromise = service.getMessageFilters();

      const req = httpMock.expectOne(`${baseUrl}/me/message-filters`);
      expect(req.request.method).toBe('GET');
      req.flush(filters);

      await expect(resultPromise).resolves.toEqual(filters);
    });

    it('should return empty object on error', async () => {
      const resultPromise = service.getMessageFilters();

      const req = httpMock.expectOne(`${baseUrl}/me/message-filters`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toEqual({});
    });
  });

  describe('setMessageFilters', () => {
    it('should PUT to /users/me/message-filters', async () => {
      const filters = { age_min: 18, age_max: 40 };
      const resultPromise = service.setMessageFilters(filters);

      const req = httpMock.expectOne(`${baseUrl}/me/message-filters`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(filters);
      req.flush(null);

      await expect(resultPromise).resolves.toBeFalsy();
    });

    it('should silently ignore errors', async () => {
      const resultPromise = service.setMessageFilters({ age_min: 18 });

      const req = httpMock.expectOne(`${baseUrl}/me/message-filters`);
      req.flush('error', { status: 500, statusText: 'Error' });

      await expect(resultPromise).resolves.toBeFalsy();
    });
  });

  describe('setDoNotDisturbSchedule', () => {
    it('should PATCH /users/me/dnd with the settings', async () => {
      const settings = { do_not_disturb: true, quiet_hours_start: '22:00', quiet_hours_end: '08:00' };
      const updatedProfile = createProfile();
      const resultPromise = service.setDoNotDisturbSchedule(settings);

      const req = httpMock.expectOne(`${baseUrl}/me/dnd`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(settings);
      req.flush(updatedProfile);

      await expect(resultPromise).resolves.toEqual(updatedProfile);
    });

    it('should fall back to mock profile on error', async () => {
      const resultPromise = service.setDoNotDisturbSchedule({ do_not_disturb: false });

      const req = httpMock.expectOne(`${baseUrl}/me/dnd`);
      req.flush('error', { status: 500, statusText: 'Error' });

      const result = await resultPromise;
      expect(result).toBeTruthy();
      expect(result.id).toBeDefined();
    });
  });
});
