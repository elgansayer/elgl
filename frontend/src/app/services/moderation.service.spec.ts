import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ModerationService, ModerationItem } from './moderation.service';
import { environment } from '../../environments/environment';

describe('ModerationService', () => {
  let service: ModerationService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/moderation`;

  const mockItem: ModerationItem = {
    id: 'item-1',
    type: 'moment',
    status: 'pending',
    created_at: '2026-07-01T00:00:00.000Z',
    reason: 'Spam',
    reporter: { id: 'user-1', display_name: 'Ada' },
    reported_user: { id: 'user-2', display_name: 'Kenji' },
    moment_content: 'Hello world',
  };

  beforeEach(() => {
    localStorage.setItem('auth_token', 'mock-token');

    TestBed.configureTestingModule({
      providers: [ModerationService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ModerationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem('auth_token');
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('fetches items with the type param and the auth header', async () => {
    const promise = service.getItems('moment');

    const req = httpMock.expectOne(`${baseUrl}/items?type=moment`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush([{ ...mockItem, type: 'moment' }]);

    const items = await promise;
    expect(items).toEqual([{ ...mockItem, type: 'moment' }]);
  });

  it('sends the status query param when a status filter is provided', async () => {
    const promise = service.getItems('moment', 'pending');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/items` &&
        r.params.get('type') === 'moment' &&
        r.params.get('status') === 'pending',
    );
    expect(req.request.method).toBe('GET');
    req.flush([{ ...mockItem, type: 'moment' }]);

    const items = await promise;
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
  });

  it('omits the status query param when no status filter is provided', async () => {
    const promise = service.getItems('profile');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/items` &&
        r.params.get('type') === 'profile' &&
        r.params.get('status') === null,
    );
    req.flush([]);

    const items = await promise;
    expect(items).toEqual([]);
  });

  it('falls back to an empty list on network error', async () => {
    const promise = service.getItems('moment');

    const req = httpMock.expectOne(`${baseUrl}/items?type=moment`);
    req.error(new ProgressEvent('network error'));

    const items = await promise;
    expect(items).toEqual([]);
  });

  it('falls back to an empty list on HTTP error', async () => {
    const promise = service.getItems('moment');

    const req = httpMock.expectOne(`${baseUrl}/items?type=moment`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    const items = await promise;
    expect(items).toEqual([]);
  });

  it('posts an approve action for an item', async () => {
    const promise = service.approveItem('item-1', 'moment');

    const req = httpMock.expectOne(`${baseUrl}/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    expect(req.request.body).toEqual({ itemId: 'item-1', type: 'moment' });
    req.flush({ success: true });

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it('posts a reject action with a reason when provided', async () => {
    const promise = service.rejectItem('item-1', 'profile', 'Inappropriate content');

    const req = httpMock.expectOne(`${baseUrl}/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      itemId: 'item-1',
      type: 'profile',
      reason: 'Inappropriate content',
    });
    req.flush({ success: true });

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it('omits the reason when rejecting without one', async () => {
    const promise = service.rejectItem('item-1', 'moment');

    const req = httpMock.expectOne(`${baseUrl}/reject`);
    expect(req.request.body).toEqual({ itemId: 'item-1', type: 'moment' });
    req.flush({ success: true });

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it('posts a user report with a description when provided', async () => {
    const promise = service.reportUser('user-9', 'spam', 'Repeated spam messages');

    const req = httpMock.expectOne(`${baseUrl}/report`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      reportedUserId: 'user-9',
      reasonCategory: 'spam',
      description: 'Repeated spam messages',
    });
    req.flush({ success: true });

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it('returns a failure response when an action request errors', async () => {
    const promise = service.approveItem('item-1', 'moment');

    const req = httpMock.expectOne(`${baseUrl}/approve`);
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Server Error' });

    const result = await promise;
    expect(result.success).toBe(false);
  });

  it('fetches user risk analysis', async () => {
    const promise = service.getUserRiskAnalysis('user-1');

    const req = httpMock.expectOne(`${baseUrl}/analyse/user-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush({ riskScore: 0.75, flags: ['spam', 'impersonation'] });

    const result = await promise;
    expect(result.riskScore).toBe(0.75);
    expect(result.flags).toEqual(['spam', 'impersonation']);
  });

  it('returns a fallback analysis on network error', async () => {
    const promise = service.getUserRiskAnalysis('user-1');

    const req = httpMock.expectOne(`${baseUrl}/analyse/user-1`);
    req.error(new ProgressEvent('network error'));

    const result = await promise;
    expect(result.riskScore).toBe(0);
    expect(result.flags).toEqual([]);
  });
});
