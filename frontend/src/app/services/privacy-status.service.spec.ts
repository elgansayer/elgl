import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { PrivacyStatusService } from './privacy-status.service';

class AuthServiceStub {
  getAccessToken(): string | null {
    return 'privacy-token';
  }
}

describe('PrivacyStatusService', () => {
  let service: PrivacyStatusService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/users`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PrivacyStatusService,
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    });
    service = TestBed.inject(PrivacyStatusService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads both persisted privacy controls from the authenticated profile', async () => {
    const resultPromise = service.load();
    const req = httpMock.expectOne(`${baseUrl}/me`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer privacy-token');
    req.flush({
      privacy_hide_online_status: true,
      privacy_hide_vip_status: false,
    });

    await expect(resultPromise).resolves.toEqual({
      hideOnlineStatus: true,
      hideVipStatus: false,
    });
  });

  it('defaults missing persisted values to visible', async () => {
    const resultPromise = service.load();
    httpMock.expectOne(`${baseUrl}/me`).flush({});

    await expect(resultPromise).resolves.toEqual({
      hideOnlineStatus: false,
      hideVipStatus: false,
    });
  });

  it('persists online visibility through the profile endpoint', async () => {
    const resultPromise = service.setHideOnlineStatus(true);
    const req = httpMock.expectOne(`${baseUrl}/me`);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ privacy_hide_online_status: true });
    req.flush({ privacy_hide_online_status: true });

    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('persists VIP visibility through the privacy endpoint', async () => {
    const resultPromise = service.setHideVipStatus(true);
    const req = httpMock.expectOne(`${baseUrl}/me/privacy`);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ privacy_hide_vip_status: true });
    req.flush({ privacy_hide_vip_status: true });

    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('propagates mutation failures so the UI can roll back', async () => {
    const resultPromise = service.setHideVipStatus(true);
    httpMock.expectOne(`${baseUrl}/me/privacy`).flush('failed', {
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(resultPromise).rejects.toBeTruthy();
  });
});
