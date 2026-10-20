import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EventsService],
    });
    service = TestBed.inject(EventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('forwards canonical event discovery filters to the API', () => {
    service
      .listEvents({
        status: 'upcoming',
        language_pair: 'en-ja',
        category: 'audio_room',
        proficiency: 'Intermediate',
        from_date: '2026-08-21T00:00:00.000Z',
        to_date: '2026-08-31T23:59:59.999Z',
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
    expect(req.request.params.get('from_date')).toBe('2026-08-21T00:00:00.000Z');
    expect(req.request.params.get('to_date')).toBe('2026-08-31T23:59:59.999Z');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([]);
  });

  it('loads category identifiers from the backend rather than a duplicated client list', () => {
    const categories = ['audio_room', 'learning_seminar'] as const;
    service.getCategories().subscribe((result) => expect(result).toEqual(categories));

    const req = httpMock.expectOne(`${environment.apiUrl}/events/categories`);
    expect(req.request.method).toBe('GET');
    req.flush(categories);
  });

  it('loads one event by its authoritative event id', () => {
    service.getEvent('event-42').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/events/event-42`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'event-42',
      title: 'Japanese practice',
      date_time: '2026-08-22T12:00:00.000Z',
      host_id: 'host-1',
      is_cancelled: false,
      created_at: '2026-08-20T12:00:00.000Z',
      updated_at: '2026-08-20T12:00:00.000Z',
    });
  });
});
