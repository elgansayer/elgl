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
