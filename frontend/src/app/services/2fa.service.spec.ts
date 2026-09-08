import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TwoFactorService } from './2fa.service';
import { AuthService } from './auth.service';

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let httpMock: HttpTestingController;

  const mockAuthService = {
    getAccessToken: () => 'mock-token'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TwoFactorService,
        { provide: AuthService, useValue: mockAuthService }
      ]
    });
    service = TestBed.inject(TwoFactorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should enable 2FA using the correct endpoint', async () => {
    const promise = service.enable();
    const req = httpMock.expectOne('/api/auth/two-factor/enable');
    expect(req.request.method).toBe('POST');
    req.flush({ secret: 'secret123', qrCodeUrl: 'http://qrcode.com' });
    const result = await promise;
    expect(result.secret).toBe('secret123');
  });

  it('should verify 2FA using the correct endpoint', async () => {
    const promise = service.verify('token123');
    const req = httpMock.expectOne('/api/auth/two-factor/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'token123' });
    req.flush({ success: true });
    const result = await promise;
    expect(result).toBe(true);
  });

  it('should disable 2FA using the correct endpoint', async () => {
    const promise = service.disable('token123');
    const req = httpMock.expectOne('/api/auth/two-factor/disable');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'token123' });
    req.flush({ success: true });
    const result = await promise;
    expect(result).toBe(true);
  });

  it('should check status using the correct endpoint', async () => {
    const promise = service.checkStatus();
    const req = httpMock.expectOne('/api/auth/two-factor/status');
    expect(req.request.method).toBe('GET');
    req.flush({ enabled: true });
    const result = await promise;
    expect(result).toBe(true);
  });
});
