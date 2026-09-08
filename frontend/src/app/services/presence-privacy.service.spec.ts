import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { PresencePrivacyService } from './presence-privacy.service';

class AuthServiceStub {
  getAccessToken(): string | null {
    return 'test-token';
  }
}

describe('PresencePrivacyService', () => {
  let service: PresencePrivacyService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/users`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PresencePrivacyService,
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    });

    service = TestBed.inject(PresencePrivacyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads both persisted privacy flags through the authenticated profile endpoint', async () => {
    const resultPromise = service.getPresencePrivacy();
    const request = httpMock.expectOne(`${baseUrl}/me`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({
      privacy_hide_online_status: true,
      privacy_hide_vip_status: false,
    });

    await expect(resultPromise).resolves.toEqual({
      privacy_hide_online_status: true,
      privacy_hide_vip_status: false,
    });
  });

  it('defaults missing privacy flags to visible', async () => {
    const resultPromise = service.getPresencePrivacy();
    httpMock.expectOne(`${baseUrl}/me`).flush({});

    await expect(resultPromise).resolves.toEqual({
      privacy_hide_online_status: false,
      privacy_hide_vip_status: false,
    });
  });

  it('persists only the requested privacy flag', async () => {
    const resultPromise = service.updatePresencePrivacy({ privacy_hide_vip_status: true });
    const request = httpMock.expectOne(`${baseUrl}/me`);

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ privacy_hide_vip_status: true });
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});

    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('propagates persistence failures instead of reporting fake success', async () => {
    const resultPromise = service.updatePresencePrivacy({ privacy_hide_online_status: true });
    const request = httpMock.expectOne(`${baseUrl}/me`);
    request.flush('failed', { status: 503, statusText: 'Service Unavailable' });

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('fails closed without an access token', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PresencePrivacyService,
        { provide: AuthService, useValue: { getAccessToken: () => null } },
      ],
    });

    service = TestBed.inject(PresencePrivacyService);
    httpMock = TestBed.inject(HttpTestingController);

    await expect(service.getPresencePrivacy()).rejects.toThrow('Authentication required');
    httpMock.expectNone(`${baseUrl}/me`);
  });
});
