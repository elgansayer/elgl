import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StudyBuddyService } from './study-buddy.service';

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

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/request');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        partnerId: 'partner-1',
        message: 'Hi there',
      });
      req.flush({});

      await expect(requestPromise).resolves.toBeUndefined();
    });

    it('should POST without a message when none is provided', async () => {
      const requestPromise = service.requestBuddy({ partnerId: 'partner-2' });

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/request');
      expect(req.request.body).toEqual({ partnerId: 'partner-2' });
      req.flush({});

      await expect(requestPromise).resolves.toBeUndefined();
    });

    it('should propagate errors so the caller can surface them', async () => {
      const requestPromise = service.requestBuddy({ partnerId: 'partner-3' });

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/request');
      req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

      await expect(requestPromise).rejects.toBeTruthy();
    });
  });

  describe('getMatches', () => {
    it('should GET matches and map valid entries', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/matches');
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

    it('should filter out malformed entries missing required fields', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/matches');
      req.flush([
        { id: '1', display_name: 'Alice' },
        { id: '2' },
        { display_name: 'No Id' },
        null,
      ]);

      await expect(matchesPromise).resolves.toEqual([
        { id: '1', display_name: 'Alice', avatar_url: undefined },
      ]);
    });

    it('should ignore a non-string avatar_url', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/matches');
      req.flush([{ id: '1', display_name: 'Alice', avatar_url: 123 }]);

      await expect(matchesPromise).resolves.toEqual([
        { id: '1', display_name: 'Alice', avatar_url: undefined },
      ]);
    });

    it('should return an empty array when the response is empty', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/matches');
      req.flush([]);

      await expect(matchesPromise).resolves.toEqual([]);
    });

    it('should return an empty array when the response is null', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/matches');
      req.flush(null as unknown as Record<string, unknown>[]);

      await expect(matchesPromise).resolves.toEqual([]);
    });

    it('should return an empty array when the request fails', async () => {
      const matchesPromise = service.getMatches();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/matches');
      req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

      await expect(matchesPromise).resolves.toEqual([]);
    });
  });

  describe('getIncomingRequests', () => {
    it('should GET pending requests', async () => {
      const requestsPromise = service.getIncomingRequests();

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/requests');
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

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/requests/req-1/accept');
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('declineRequest', () => {
    it('should POST to the decline endpoint', async () => {
      const promise = service.declineRequest('req-1');

      const req = httpMock.expectOne('http://127.0.0.1:3000/api/study-buddies/requests/req-1/decline');
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
