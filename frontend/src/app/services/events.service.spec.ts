import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { EventsService } from './events.service';

describe('EventsService calendar API', () => {
  let service: EventsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('serializes the displayed month range to the authenticated calendar endpoint', async () => {
    const responsePromise = firstValueFrom(
      service.getMyCalendarEvents({
        from_date: '2026-08-01T00:00:00.000Z',
        to_date: '2026-08-31T23:59:59.999Z',
        limit: 100,
      }),
    );

    const req = httpMock.expectOne((request) =>
      request.url === `${environment.apiUrl}/events/my/calendar`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from_date')).toBe('2026-08-01T00:00:00.000Z');
    expect(req.request.params.get('to_date')).toBe('2026-08-31T23:59:59.999Z');
    expect(req.request.params.get('limit')).toBe('100');
    req.flush([]);

    await expect(responsePromise).resolves.toEqual([]);
  });

  it('omits the optional limit when callers do not provide one', async () => {
    const responsePromise = firstValueFrom(
      service.getMyCalendarEvents({
        from_date: '2026-09-01T00:00:00.000Z',
        to_date: '2026-09-30T23:59:59.999Z',
      }),
    );

    const req = httpMock.expectOne((request) =>
      request.url === `${environment.apiUrl}/events/my/calendar`,
    );
    expect(req.request.params.has('limit')).toBe(false);
    req.flush([]);

    await expect(responsePromise).resolves.toEqual([]);
  });
});
