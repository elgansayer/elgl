import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StudyBuddiesService } from './study-buddies.service';

describe('StudyBuddiesService', () => {
  let service: StudyBuddiesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StudyBuddiesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('follow', () => {
    it('should POST to the follow endpoint', async () => {
      const promise = service.follow('user-1');

      const req = httpMock.expectOne('http://localhost:3000/api/study-buddies/follow');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ targetUserId: 'user-1' });
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('unfollow', () => {
    it('should DELETE to the unfollow endpoint', async () => {
      const promise = service.unfollow('user-1');

      const req = httpMock.expectOne('http://localhost:3000/api/study-buddies/unfollow');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ targetUserId: 'user-1' });
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('getOrCreateChannel', () => {
    it('should GET the channel endpoint', async () => {
      const promise = service.getOrCreateChannel('user-1');

      const req = httpMock.expectOne('http://localhost:3000/api/study-buddies/channel?partnerId=user-1');
      expect(req.request.method).toBe('GET');
      req.flush({ channel: 'channel-1' });

      await expect(promise).resolves.toEqual({ channel: 'channel-1' });
    });
  });
});
