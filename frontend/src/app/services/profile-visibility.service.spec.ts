import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ProfileVisibilityService } from './profile-visibility.service';

class AuthServiceStub {
  getAccessToken(): string | null {
    return 'test-token';
  }
}

describe('ProfileVisibilityService', () => {
  let service: ProfileVisibilityService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/users`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileVisibilityService,
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    });

    service = TestBed.inject(ProfileVisibilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the persisted visibility with authenticated GET', async () => {
    const resultPromise = service.getProfileVisibility();
    const request = httpMock.expectOne(`${baseUrl}/me/privacy-settings`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ profile_visibility: 'vips_only' });

    await expect(resultPromise).resolves.toBe('vips_only');
  });

  it('defaults missing visibility to everyone', async () => {
    const resultPromise = service.getProfileVisibility();
    const request = httpMock.expectOne(`${baseUrl}/me/privacy-settings`);
    request.flush({});

    await expect(resultPromise).resolves.toBe('everyone');
  });

  it('persists visibility through the validated privacy endpoint', async () => {
    const resultPromise = service.updateProfileVisibility('hidden');
    const request = httpMock.expectOne(`${baseUrl}/me/privacy`);

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ profile_visibility: 'hidden' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});

    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('propagates persistence failures instead of reporting fake success', async () => {
    const resultPromise = service.updateProfileVisibility('vips_only');
    const request = httpMock.expectOne(`${baseUrl}/me/privacy`);
    request.flush('failed', { status: 503, statusText: 'Service Unavailable' });

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('fails closed without an access token', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileVisibilityService,
        { provide: AuthService, useValue: { getAccessToken: () => null } },
      ],
    });

    service = TestBed.inject(ProfileVisibilityService);
    httpMock = TestBed.inject(HttpTestingController);

    await expect(service.getProfileVisibility()).rejects.toThrow('Authentication required');
    httpMock.expectNone(`${baseUrl}/me/privacy-settings`);
  });
});
