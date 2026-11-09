import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SharingService } from './sharing';
import { environment } from '../../environments/environment';

describe('SharingService', () => {
  let service: SharingService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SharingService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('resolves a typed preview for an entity', async () => {
    const promise = service.getPreview('event', 'event-1');
    const request = httpTesting.expectOne(`${environment.apiUrl}/sharing/preview/event/event-1`);
    expect(request.request.method).toBe('GET');
    request.flush({
      entityType: 'event',
      entityId: 'event-1',
      title: 'Tokyo Language Cafe',
      description: 'Meet other learners',
      imageUrl: null,
      siteName: 'HelloTalk',
      shareUrl: 'https://hellotalk.example/api/sharing/og/event/event-1',
      webUrl: '/events/event-1',
      deepLink: 'hellotalk://events/event-1',
      pricing: null,
    });

    await expect(promise).resolves.toMatchObject({
      title: 'Tokyo Language Cafe',
      webUrl: '/events/event-1',
    });
  });

  it('creates an authenticated share link', async () => {
    const promise = service.createShareLink('room', 'room-1');
    const request = httpTesting.expectOne(`${environment.apiUrl}/sharing/link/room/room-1`);
    expect(request.request.method).toBe('GET');
    request.flush({
      entityType: 'room',
      entityId: 'room-1',
      shareUrl: 'https://hellotalk.example/api/sharing/og/room/room-1',
      webUrl: '/audio-rooms?join=room-1',
      deepLink: 'hellotalk://audio-rooms/room-1',
    });

    await expect(promise).resolves.toMatchObject({
      shareUrl: 'https://hellotalk.example/api/sharing/og/room/room-1',
      webUrl: '/audio-rooms?join=room-1',
    });
  });
});
