import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GdprService } from './gdpr.service';

describe('GdprService', () => {
  let service: GdprService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GdprService],
    });
    service = TestBed.inject(GdprService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads and normalizes authoritative deletion status', async () => {
    const resultPromise = service.getStatus();

    const req = httpMock.expectOne('/api/privacy/status');
    expect(req.request.method).toBe('GET');
    req.flush({
      deletion: {
        pending: true,
        scheduled_for: '2026-09-26T04:00:00Z',
        requested_at: '2026-08-27T04:00:00Z',
      },
    });

    await expect(resultPromise).resolves.toEqual({
      deletion: {
        pending: true,
        scheduled_for: '2026-09-26T04:00:00.000Z',
        requested_at: '2026-08-27T04:00:00.000Z',
      },
    });
  });

  it('accepts null deletion timestamps', async () => {
    const resultPromise = service.getStatus();
    httpMock.expectOne('/api/privacy/status').flush({
      deletion: {
        pending: false,
        scheduled_for: null,
        requested_at: null,
      },
    });

    await expect(resultPromise).resolves.toEqual({
      deletion: {
        pending: false,
        scheduled_for: null,
        requested_at: null,
      },
    });
  });

  it('rejects malformed lifecycle response shapes', async () => {
    const missingDeletion = service.getStatus();
    httpMock.expectOne('/api/privacy/status').flush({ pending: false });
    await expect(missingDeletion).rejects.toThrow('Invalid privacy status response');

    const invalidPending = service.getStatus();
    httpMock.expectOne('/api/privacy/status').flush({
      deletion: {
        pending: 'false',
        scheduled_for: null,
        requested_at: null,
      },
    });
    await expect(invalidPending).rejects.toThrow('Invalid privacy status response');
  });

  it('rejects malformed lifecycle timestamps', async () => {
    const resultPromise = service.getStatus();
    httpMock.expectOne('/api/privacy/status').flush({
      deletion: {
        pending: true,
        scheduled_for: 'not-a-date',
        requested_at: null,
      },
    });

    await expect(resultPromise).rejects.toThrow('Invalid privacy status timestamp');
  });

  it('sends explicit confirmation for account deletion', async () => {
    const resultPromise = service.deleteAccount(true);

    const req = httpMock.expectOne('/api/privacy/delete-account');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ confirm_delete: true });
    req.flush({ message: 'accepted' });

    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('uses a POST mutation when cancelling deletion', async () => {
    const resultPromise = service.cancelDeletion();

    const req = httpMock.expectOne('/api/privacy/cancel-deletion');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ message: 'cancelled' });

    await expect(resultPromise).resolves.toBeUndefined();
  });
});
