import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EventsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('serializes supported discovery filters with backend category values', () => {
    service
      .listEvents({
        status: 'upcoming',
        language_pair: 'en-ja',
        category: 'audio_room',
        proficiency: 'Intermediate',
        from_date: '2026-08-21T00:00:00.000Z',
        to_date: '2026-09-21T00:00:00.000Z',
        page: 2,
        limit: 20,
      })
      .subscribe();

    const req = httpMock.expectOne((request) => request.url === `${environment.apiUrl}/events`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('upcoming');
    expect(req.request.params.get('language_pair')).toBe('en-ja');
    expect(req.request.params.get('category')).toBe('audio_room');
    expect(req.request.params.get('proficiency')).toBe('Intermediate');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([]);
  });

  it('loads the category catalogue from the authenticated backend endpoint', () => {
    service.getCategories().subscribe((categories) => {
      expect(categories).toEqual(['audio_room', 'learning_seminar']);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/events/categories`);
    expect(req.request.method).toBe('GET');
    req.flush(['audio_room', 'learning_seminar']);
  });

  it('loads an event detail through the canonical event endpoint', () => {
    service.getEvent('event-123').subscribe((event) => {
      expect(event.id).toBe('event-123');
      expect(event.attendees_count).toBe(8);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/events/event-123`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'event-123',
      title: 'Japanese practice',
      date_time: '2026-08-25T18:00:00.000Z',
      host_id: 'host-1',
      is_cancelled: false,
      created_at: '2026-08-20T12:00:00.000Z',
      updated_at: '2026-08-20T12:00:00.000Z',
      attendees_count: 8,
    });
  });
});
