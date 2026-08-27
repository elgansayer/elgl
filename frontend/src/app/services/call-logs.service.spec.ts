import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { CallLogsService, CallLogRecord } from './call-logs.service';

describe('CallLogsService', () => {
  let service: CallLogsService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/audio-rooms/call-logs`;

  const record: CallLogRecord = {
    id: 'log-1',
    caller_id: 'user-1',
    caller_name: 'Alex',
    receiver_id: 'user-2',
    receiver_name: 'Sam',
    call_type: 'missed',
    room_name: 'room-1',
    started_at: '2026-08-01T10:00:00Z',
    ended_at: null,
    duration_seconds: null,
    created_at: '2026-08-01T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CallLogsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CallLogsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests call logs from the backend REST API with default paging', async () => {
    const resultPromise = service.getCallLogs();

    const req = httpMock.expectOne(
      (r) => r.url === baseUrl && r.params.get('limit') === '20' && r.params.get('offset') === '0',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('callType')).toBe(false);

    req.flush([record]);

    const result = await resultPromise;
    expect(result).toEqual([record]);
  });

  it('includes the callType filter when provided', async () => {
    const resultPromise = service.getCallLogs({ callType: 'missed' });

    const req = httpMock.expectOne(
      (r) => r.url === baseUrl && r.params.get('callType') === 'missed',
    );
    req.flush([record]);

    const result = await resultPromise;
    expect(result).toEqual([record]);
  });

  it('propagates errors from the backend', async () => {
    const resultPromise = service.getCallLogs();

    const req = httpMock.expectOne((r) => r.url === baseUrl);
    req.error(new ProgressEvent('Network error'));

    let threw = false;
    try {
      await resultPromise;
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
