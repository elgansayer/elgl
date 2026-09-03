import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { FcmService } from './fcm.service';
import { PLATFORM_ID } from '@angular/core';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockSupabaseService = {
    getClient: () => ({
      auth: {
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        setSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      }
    })
  };

  const mockFcmService = {
    requestPermissionAndGetToken: vi.fn().mockResolvedValue('fcm-token'),
    registerToken: vi.fn().mockResolvedValue(undefined),
    unregisterToken: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: FcmService, useValue: mockFcmService },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call the correct endpoint for transfer generate', async () => {
    // Mock the token
    vi.spyOn(service, 'currentSession').mockReturnValue({ access_token: 'mock-token' } as any);

    const promise = service.generateDeviceLink();
    const req = httpMock.expectOne('/api/transfer/generate');
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'http://test.com' });
    const result = await promise;
    expect(result).toBe('http://test.com');
  });

  it('should call the correct endpoint for transfer consume', async () => {
    const promise = service.consumeDeviceLink('mock-token');
    const req = httpMock.expectOne('/api/transfer/consume');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'mock-token' });
    req.flush({ swapToken: 'swap123' });
    const result = await promise;
    expect(result.swapToken).toBe('swap123');
  });

  it('should call the correct endpoint for transfer swap', async () => {
    const promise = service.swapDeviceLink('swap123');
    const req = httpMock.expectOne('/api/transfer/swap');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ swapToken: 'swap123' });
    req.flush({ access_token: 'a', refresh_token: 'r', user_id: 'u' });
    const result = await promise;
    expect(result).toBe(true);
  });
});
