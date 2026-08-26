import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StudyBuddyService } from './study-buddy.service';
import { environment } from '../../environments/environment';

describe('StudyBuddyService', () => {
  let service: StudyBuddyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StudyBuddyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('requestBuddy', () => {
    it('should POST the dto to the request endpoint', async () => {
      const requestPromise = service.requestBuddy({
        partnerId: 'partner-1',
        message: 'Hi there',
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/study-buddies/request`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        partnerId: 'partner-1',
        message: 'Hi there',
      });
      req.flush({});

      await expect(requestPromise).resolves.toBeUndefined();
    });
  });

  describe('getMatches', () => {
    it('should GET matches and map valid entries', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne(`${environment.apiUrl}/study-buddies/matches`);
      expect(req.request.method).toBe('GET');
      req.flush([
        { id: '1', display_name: 'Alice', avatar_url: 'https://example.com/alice.png' },
        { id: '2', display_name: 'Bob' },
      ]);

      await expect(matchesPromise).resolves.toEqual([
        { id: '1', display_name: 'Alice', avatar_url: 'https://example.com/alice.png' },
        { id: '2', display_name: 'Bob', avatar_url: undefined },
      ]);
    });
  });

  describe('getIncomingRequests', () => {
    it('should GET pending requests', async () => {
      const requestsPromise = service.getIncomingRequests();

      const req = httpMock.expectOne(`${environment.apiUrl}/study-buddies/requests`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 'req-1', requesterId: 'user-2', partnerId: 'user-1', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z' }]);

      await expect(requestsPromise).resolves.toEqual([
        {
          id: 'req-1',
          requesterId: 'user-2',
          partnerId: 'user-1',
          status: 'pending',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('acceptRequest', () => {
    it('should POST to the accept endpoint', async () => {
      const promise = service.acceptRequest('req-1');

      const req = httpMock.expectOne(`${environment.apiUrl}/study-buddies/requests/req-1/accept`);
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('declineRequest', () => {
    it('should POST to the decline endpoint', async () => {
      const promise = service.declineRequest('req-1');

      const req = httpMock.expectOne(`${environment.apiUrl}/study-buddies/requests/req-1/decline`);
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
