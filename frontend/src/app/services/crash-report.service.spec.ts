import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrashReportService } from './crash-report.service';
import { AuthService } from './auth.service';

// Mock IndexedDB
const indexedDBMock = {
  open: vi.fn(),
};

Object.defineProperty(globalThis, 'indexedDB', {
  value: indexedDBMock, configurable: true,
  writable: true,
});

describe('CrashReportService', () => {
  let service: CrashReportService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();

    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
    };

    // Mock IndexedDB that fires onsuccess synchronously
    indexedDBMock.open.mockImplementation(() => {
      const request: Record<string, unknown> = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: {
          createObjectStore: vi.fn(),
          objectStoreNames: {
            contains: vi.fn().mockReturnValue(false),
          },
          transaction: vi.fn().mockImplementation(() => {
            const tx: Record<string, unknown> = {
              oncomplete: null,
              onerror: null,
            };
            tx['objectStore'] = vi.fn().mockReturnValue({
              add: vi.fn(),
              put: vi.fn(),
              get: vi.fn(),
              getAll: vi.fn().mockReturnValue({
                onsuccess: null,
                onerror: null,
                result: [],
              }),
              clear: vi.fn(),
              index: vi.fn().mockReturnValue({
                getAll: vi.fn().mockReturnValue({
                  onsuccess: null,
                  onerror: null,
                  result: [],
                }),
                openCursor: vi.fn().mockReturnValue({
                  onsuccess: null,
                  onerror: null,
                  result: null,
                }),
              }),
              delete: vi.fn(),
            });
            // Fire oncomplete synchronously
            queueMicrotask(() => {
              const cb = tx['oncomplete'] as ((e: Event) => void) | null;
              if (cb) cb({} as Event);
            });
            return tx;
          }),
        },
        error: null,
      };
      // Fire onsuccess synchronously so initPromise resolves immediately
      queueMicrotask(() => {
        const cb = request['onsuccess'] as ((e: Event) => void) | null;
        if (cb) cb({ target: request } as unknown as Event);
      });
      return request;
    });

    TestBed.configureTestingModule({
      providers: [
        CrashReportService,
        { provide: AuthService, useValue: mockAuthService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CrashReportService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialise pendingCrashCount to 0', () => {
    expect(service.pendingCrashCount()).toBe(0);
  });

  it('should initialise lastCrash to null', () => {
    expect(service.lastCrash()).toBeNull();
  });

  it('should POST crash report to the analytics endpoint', async () => {
    const error = new Error('Test admin crash');
    const reportPromise = service.reportCrash(error, {
      route: '/admin/users',
      component: 'AdminUsers',
      adminRole: 'admin',
      offline: false,
    });

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        message: 'Test admin crash',
        name: 'Error',
        adminContext: expect.objectContaining({
          route: '/admin/users',
          component: 'AdminUsers',
        }),
      }),
    );
    req.flush({ status: 'logged' });

    await reportPromise;
  });

  it('should set lastCrash after reporting', async () => {
    const error = new Error('Boom');
    const reportPromise = service.reportCrash(error, {
      route: '/admin/blocks',
      component: 'AdminBlocks',
      adminRole: 'admin',
      offline: false,
    });

    const req = httpTesting.expectOne('/api/analytics/client-error');
    req.flush({ status: 'logged' });
    await reportPromise;

    expect(service.lastCrash()).toBeTruthy();
    expect(service.lastCrash()?.message).toBe('Boom');
    expect(service.lastCrash()?.adminContext?.component).toBe('AdminBlocks');
  });

  it('should include componentStack when provided', async () => {
    const error = new Error('Render error');
    const reportPromise = service.reportCrash(
      error,
      {
        route: '/admin/users',
        component: 'AdminUsers',
        adminRole: 'admin',
        offline: false,
      },
      'AdminUsersComponent.render -> admin-users.ts:99:5',
    );

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        componentStack: 'AdminUsersComponent.render -> admin-users.ts:99:5',
      }),
    );
    req.flush({ status: 'logged' });
    await reportPromise;
  });

  it('should include offline context', async () => {
    const error = new Error('Offline crash');
    const reportPromise = service.reportCrash(error, {
      route: '/admin/moderation',
      component: 'ModerationQueue',
      adminRole: 'admin',
      offline: true,
    });

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        adminContext: expect.objectContaining({
          offline: true,
        }),
      }),
    );
    req.flush({ status: 'logged' });
    await reportPromise;
  });

  it('should handle API failure without throwing', async () => {
    // Empty array from getAll and mock that resolves initPromise immediately
    indexedDBMock.open.mockReturnValue({
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      result: {
        createObjectStore: vi.fn(),
        objectStoreNames: {
          contains: vi.fn().mockReturnValue(false),
        },
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            add: vi.fn(),
            put: vi.fn(),
            get: vi.fn(),
            getAll: vi.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
              result: [],
            }),
            clear: vi.fn(),
            index: vi.fn().mockReturnValue({
              getAll: vi.fn().mockReturnValue({
                onsuccess: null,
                onerror: null,
                result: [],
              }),
              openCursor: vi.fn().mockReturnValue({
                onsuccess: null,
                onerror: null,
                result: null,
              }),
            }),
            delete: vi.fn(),
          }),
          oncomplete: null,
          onerror: null,
        }),
      },
    });

    // Manually resolve the initPromise by triggering onsuccess
    const openRequest = indexedDBMock.open();

    const error = new Error('Crash while offline');
    const reportPromise = service.reportCrash(error, {
      route: '/admin',
      component: 'AdminPortal',
      adminRole: 'admin',
      offline: true,
    });

    // Fire the onsuccess callback to resolve initPromise
    if (openRequest.onsuccess) {
      openRequest.onsuccess({ target: openRequest } as unknown as Event);
    }

    // API request fails
    const req = httpTesting.expectOne('/api/analytics/client-error');
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    // Should not throw even when API is down
    await expect(reportPromise).resolves.toBeUndefined();
  });
});