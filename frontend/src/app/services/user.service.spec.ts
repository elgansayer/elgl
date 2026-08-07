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

  describe('downloadMyData', () => {
    it('should GET /users/me/export and trigger a browser download', async () => {
      const mockExportData = { profile: { id: 'user-1' }, moments: [] };
      const resultPromise = service.downloadMyData();

      const req = httpMock.expectOne(`${baseUrl}/me/export`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(mockExportData);

      await resultPromise;
      // The method creates a Blob and triggers a download via a temporary anchor element.
      // It should not throw.
    });

    it('should throw an error when the export endpoint fails', async () => {
      const resultPromise = service.downloadMyData();

      const req = httpMock.expectOne(`${baseUrl}/me/export`);
      req.flush('Server error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(resultPromise).rejects.toThrow();
    });
  });
});
