import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { GdprService } from './gdpr.service';

describe('GdprService', () => {
  let service: GdprService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GdprService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GdprService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('restores persisted privacy status through environment.apiUrl', async () => {
    const resultPromise = service.getStatus();
    const request = httpTesting.expectOne(`${environment.apiUrl}/privacy/status`);

    expect(request.request.method).toBe('GET');
    request.flush({
      is_deletion_pending: true,
      scheduled_for_deletion_at: '2026-09-29T00:00:00.000Z',
      latest_archive: null,
    });

    await expect(resultPromise).resolves.toEqual({
      is_deletion_pending: true,
      scheduled_for_deletion_at: '2026-09-29T00:00:00.000Z',
      latest_archive: null,
    });
  });

  it('requests an archive through environment.apiUrl', async () => {
    const resultPromise = service.requestArchive('receipt-1', 'ios');
    const request = httpTesting.expectOne(`${environment.apiUrl}/privacy/request-archive`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ receipt_id: 'receipt-1', app_store: 'ios' });
    request.flush({ request_id: 'request-1', status: 'processing', message: 'queued' });

    await expect(resultPromise).resolves.toEqual({
      request_id: 'request-1',
      status: 'processing',
      message: 'queued',
    });
  });

  it('requests account deletion through environment.apiUrl', async () => {
    const resultPromise = service.deleteAccount(true);
    const request = httpTesting.expectOne(`${environment.apiUrl}/privacy/delete-account`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ confirm_delete: true });
    request.flush({});

    await resultPromise;
  });

  it('cancels deletion through environment.apiUrl', async () => {
    const resultPromise = service.cancelDeletion();
    const request = httpTesting.expectOne(`${environment.apiUrl}/privacy/cancel-deletion`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({});

    await resultPromise;
  });
});
