import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ProfileVisitsService } from './profile-visits.service';

describe('ProfileVisitsService', () => {
  let service: ProfileVisitsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileVisitsService,
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token-1' },
        },
      ],
    });

    service = TestBed.inject(ProfileVisitsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a bounded visitor page from the canonical endpoint', async () => {
    const resultPromise = service.getMyVisitors(20, 40);
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/profile-visits/my-visitors` &&
        candidate.params.get('limit') === '20' &&
        candidate.params.get('offset') === '40',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({
      items: [],
      identity_visible: false,
      limit: 20,
      offset: 40,
      has_more: false,
      next_offset: null,
    });

    const result = await resultPromise;
    expect(result).toMatchObject({ offset: 40, has_more: false });
  });

  it('removes identity data from a masked page before returning it to callers', async () => {
    const resultPromise = service.getMyVisitors();
    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/profile-visits/my-visitors`,
    );
    request.flush({
      items: [
        {
          id: 'visit-1',
          created_at: '2026-08-24T09:00:00.000Z',
          is_blurred: true,
          visitor: {
            id: 'private-user-id',
            display_name: 'Private Name',
            avatar_url: 'https://example.com/private.jpg',
            native_languages: ['ja'],
            target_languages: ['en'],
          },
        },
      ],
      identity_visible: false,
      limit: 20,
      offset: 0,
      has_more: false,
      next_offset: null,
    });

    const result = await resultPromise;
    expect(result.identity_visible).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.is_blurred).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Private Name');
    expect(JSON.stringify(result)).not.toContain('private.jpg');
    expect(JSON.stringify(result)).not.toContain('private-user-id');
  });

  it('keeps visible identities when the server authorises them', async () => {
    const resultPromise = service.getMyVisitors();
    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/profile-visits/my-visitors`,
    );
    request.flush({
      items: [
        {
          id: 'visit-1',
          created_at: '2026-08-24T09:00:00.000Z',
          is_blurred: false,
          visitor: {
            id: 'visitor-1',
            display_name: 'Aiko',
            avatar_url: 'https://example.com/aiko.jpg',
            native_languages: ['ja'],
            target_languages: ['en'],
          },
        },
      ],
      identity_visible: true,
      limit: 20,
      offset: 0,
      has_more: false,
      next_offset: null,
    });

    const result = await resultPromise;
    expect(result.identity_visible).toBe(true);
    expect(result.items[0]?.visitor).toMatchObject({ id: 'visitor-1', display_name: 'Aiko' });
  });

  it('rejects a response that is not a visitor page instead of reporting an empty history', async () => {
    const resultPromise = service.getMyVisitors();
    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/profile-visits/my-visitors`,
    );
    request.flush([]);

    await expect(resultPromise).rejects.toThrow();
  });

  it('propagates HTTP failures so callers can show a retry state', async () => {
    const resultPromise = service.getMyVisitors();
    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/profile-visits/my-visitors`,
    );
    request.flush({ message: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('records a profile view without sending entitlement state in the body', async () => {
    const resultPromise = service.recordVisit('target-1');
    const request = http.expectOne(`${environment.apiUrl}/profile-visits/target-1`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({ recorded: false, ignored: true, reason: 'duplicate' });

    const result = await resultPromise;
    expect(result).toEqual({
      recorded: false,
      ignored: true,
      reason: 'duplicate',
    });
  });
});
