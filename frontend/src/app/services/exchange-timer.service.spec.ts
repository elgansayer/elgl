import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  ExchangeTimerService,
  ExchangeTimerStatus,
} from './exchange-timer.service';

const ROOM_NAME = 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const REMOTE_ID = '22222222-2222-4222-8222-222222222222';

const activeStatus: ExchangeTimerStatus = {
  active: true,
  waitingForParticipant: false,
  reciprocal: true,
  roomName: ROOM_NAME,
  turnDurationSeconds: 300,
  turnIndex: 0,
  currentSpeakerId: CALLER_ID,
  currentSpeakerLanguage: 'en',
  remainingSeconds: 240,
  isCurrentSpeaker: true,
  participants: [
    { userId: CALLER_ID, language: 'en', turnsTaken: 0 },
    { userId: REMOTE_ID, language: 'es', turnsTaken: 0 },
  ],
};

describe('ExchangeTimerService', () => {
  let service: ExchangeTimerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ExchangeTimerService,
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('mock-jwt') },
        },
      ],
    });

    service = TestBed.inject(ExchangeTimerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stop();
    httpMock.verify();
  });

  it('loads the server-authoritative turn state for the room', async () => {
    const startPromise = service.start(ROOM_NAME);

    const request = httpMock.expectOne(
      `${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-jwt');
    request.flush(activeStatus);
    await startPromise;

    expect(service.isActive()).toBe(true);
    expect(service.isMyTurn()).toBe(true);
    expect(service.canSpeak()).toBe(true);
    expect(service.remainingSeconds()).toBe(240);
    expect(service.currentSpeakerLanguage()).toBe('en');
  });

  it('blocks speaking while the partner holds the turn', async () => {
    const startPromise = service.start(ROOM_NAME);
    httpMock
      .expectOne(`${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer`)
      .flush({
        ...activeStatus,
        currentSpeakerId: REMOTE_ID,
        currentSpeakerLanguage: 'es',
        isCurrentSpeaker: false,
      });
    await startPromise;

    expect(service.isMyTurn()).toBe(false);
    expect(service.canSpeak()).toBe(false);
  });

  it('advances the turn with the observed index for idempotency', async () => {
    const startPromise = service.start(ROOM_NAME);
    httpMock
      .expectOne(`${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer`)
      .flush(activeStatus);
    await startPromise;

    const advancePromise = service.advanceTurn();
    const request = httpMock.expectOne(
      `${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer/advance`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expectedTurnIndex: 0 });
    request.flush({
      ...activeStatus,
      turnIndex: 1,
      currentSpeakerId: REMOTE_ID,
      currentSpeakerLanguage: 'es',
      isCurrentSpeaker: false,
      remainingSeconds: 300,
    });

    await expect(advancePromise).resolves.toBe(true);
    expect(service.isMyTurn()).toBe(false);
    expect(service.remainingSeconds()).toBe(300);
  });

  it('degrades without throwing when the timer endpoint is unavailable', async () => {
    const startPromise = service.start(ROOM_NAME);
    httpMock
      .expectOne(`${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    await startPromise;

    expect(service.unavailable()).toBe(true);
    expect(service.isActive()).toBe(false);
    expect(service.canSpeak()).toBe(true);
  });

  it('clears state and stops polling when the call ends', async () => {
    const startPromise = service.start(ROOM_NAME);
    httpMock
      .expectOne(`${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer`)
      .flush(activeStatus);
    await startPromise;

    service.stop();
    httpMock.expectNone(
      `${environment.apiUrl}/video-calls/${ROOM_NAME}/exchange-timer`,
    );

    expect(service.status()).toBeNull();
    expect(service.remainingSeconds()).toBe(0);
    expect(service.isActive()).toBe(false);
  });
});
