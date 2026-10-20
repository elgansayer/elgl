import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';
import { DeviceTransferComponent } from './device-transfer.component';

describe('DeviceTransferComponent API URLs', () => {
  let component: DeviceTransferComponent;
  let httpTesting: HttpTestingController;
  const setSession = vi.fn().mockResolvedValue({ data: {}, error: null });
  const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn().mockReturnValue(null) } } },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        {
          provide: AuthService,
          useValue: { generateDeviceLink: vi.fn(() => new Promise<string>(() => undefined)) },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth: { setSession, getSession } }) },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new DeviceTransferComponent());
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('consumes and swaps a transfer token through environment.apiUrl', async () => {
    const receivePromise = (
      component as unknown as { onReceive(token: string): Promise<void> }
    ).onReceive('transfer-token');

    const consumeRequest = httpTesting.expectOne(`${environment.apiUrl}/transfer/consume`);
    expect(consumeRequest.request.method).toBe('POST');
    expect(consumeRequest.request.body).toEqual({ token: 'transfer-token' });
    consumeRequest.flush({ swapToken: 'swap-token' });

    await Promise.resolve();
    const swapRequest = httpTesting.expectOne(`${environment.apiUrl}/transfer/swap`);
    expect(swapRequest.request.method).toBe('POST');
    expect(swapRequest.request.body).toEqual({ swapToken: 'swap-token' });
    swapRequest.flush({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user_id: 'user-1',
    });

    await receivePromise;
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(component.status()).toBe('done');
  });
});
