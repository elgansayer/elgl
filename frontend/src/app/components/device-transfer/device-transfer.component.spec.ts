import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DeviceTransferComponent } from './device-transfer.component';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';

describe('DeviceTransferComponent', () => {
  let component: DeviceTransferComponent;
  let fixture: ComponentFixture<DeviceTransferComponent>;
  let httpMock: HttpTestingController;
  let authServiceMock: any;
  let supabaseServiceMock: any;
  let routerMock: any;

  beforeEach(async () => {
    authServiceMock = {
      generateDeviceLink: vi.fn().mockResolvedValue('http://mock.link'),
    };
    supabaseServiceMock = {
      getClient: vi.fn().mockReturnValue({
        auth: {
          setSession: vi.fn().mockResolvedValue({}),
          getSession: vi.fn().mockResolvedValue({ data: { session: { user: 'mock' } } }),
        },
      }),
    };
    routerMock = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DeviceTransferComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: SupabaseService, useValue: supabaseServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn().mockReturnValue('mock-token'),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceTransferComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create and consume token on init', async () => {
    expect(component).toBeTruthy();
    expect(component.status()).toBe('consuming');

    const consumeReq = httpMock.expectOne(`${environment.apiUrl}/transfer/consume`);
    expect(consumeReq.request.method).toBe('POST');
    expect(consumeReq.request.body).toEqual({ token: 'mock-token' });
    consumeReq.flush({ swapToken: 'mock-swap' });

    // We have to wait for the microtask to run the next await
    await new Promise(r => setTimeout(r, 0));

    const swapReq = httpMock.expectOne(`${environment.apiUrl}/transfer/swap`);
    expect(swapReq.request.method).toBe('POST');
    expect(swapReq.request.body).toEqual({ swapToken: 'mock-swap' });
    swapReq.flush({ access_token: 'acc', refresh_token: 'ref', user_id: 'u1' });

    await new Promise(r => setTimeout(r, 0));

    expect(component.status()).toBe('done');
  });
});
