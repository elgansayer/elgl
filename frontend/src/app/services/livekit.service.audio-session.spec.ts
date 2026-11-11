import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalE2EEKeyProvider } from 'livekit-client';
import { environment } from '../../environments/environment';
import { CallAudioSessionService } from './call-audio-session.service';
import { LivekitService } from './livekit.service';

describe('LivekitService call audio session wiring', () => {
  let service: LivekitService;
  let httpMock: HttpTestingController;
  let audioSession: { attach: ReturnType<typeof vi.fn>; detach: ReturnType<typeof vi.fn> };
  let fakeRoom: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // The real key provider needs Web Crypto, which is not what these tests are about.
    vi.spyOn(ExternalE2EEKeyProvider.prototype, 'setKey').mockResolvedValue(undefined);
    vi.stubGlobal(
      'Worker',
      class {
        terminate = vi.fn();
      },
    );
    audioSession = { attach: vi.fn(), detach: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CallAudioSessionService, useValue: audioSession },
      ],
    });
    service = TestBed.inject(LivekitService);
    httpMock = TestBed.inject(HttpTestingController);
    fakeRoom = { connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() };
    (service as unknown as { createRoom: () => unknown }).createRoom = () => fakeRoom;
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function answerJoinRequest(): void {
    httpMock
      .expectOne(`${environment.apiUrl}/video-calls/accept`)
      .flush({ token: 'join-token', roomName: 'video_room', e2eeKey: 'ephemeral-key' });
  }

  it('attaches the connected room to the call audio session', async () => {
    const joining = service.joinRoom('video_room', 'user-1', false);
    answerJoinRequest();

    const room = await joining;

    expect(room).toBe(fakeRoom);
    expect(audioSession.attach).toHaveBeenCalledTimes(1);
    expect(audioSession.attach).toHaveBeenCalledWith(fakeRoom, 'call');
  });

  it('attaches only after the room has connected', async () => {
    const joining = service.joinRoom('video_room', 'user-1', false);
    answerJoinRequest();
    await joining;

    expect(fakeRoom.connect.mock.invocationCallOrder[0]).toBeLessThan(
      audioSession.attach.mock.invocationCallOrder[0],
    );
  });

  it('does not attach a room that never connected', async () => {
    vi.useFakeTimers();
    fakeRoom.connect.mockRejectedValue(new Error('network unreachable'));
    const joining = service.joinRoom('video_room', 'user-1', false);
    const outcome = expect(joining).rejects.toThrow('network unreachable');
    answerJoinRequest();

    await vi.advanceTimersByTimeAsync(10_000);
    await outcome;

    expect(fakeRoom.connect).toHaveBeenCalledTimes(3);
    expect(audioSession.attach).not.toHaveBeenCalled();
    expect(service.livekitConnected()).toBe(false);
  });

  it('attaches after a retry succeeds', async () => {
    vi.useFakeTimers();
    fakeRoom.connect.mockRejectedValueOnce(new Error('transient')).mockResolvedValue(undefined);
    const joining = service.joinRoom('video_room', 'user-1', false);
    answerJoinRequest();

    await vi.advanceTimersByTimeAsync(10_000);
    await joining;

    expect(fakeRoom.connect).toHaveBeenCalledTimes(2);
    expect(audioSession.attach).toHaveBeenCalledTimes(1);
  });

  it('never reconnects a connected room because attaching failed', async () => {
    audioSession.attach.mockImplementation(() => {
      throw new Error('attach failed');
    });
    const joining = service.joinRoom('video_room', 'user-1', false);
    const outcome = expect(joining).rejects.toThrow('attach failed');
    answerJoinRequest();

    await outcome;

    expect(fakeRoom.connect).toHaveBeenCalledTimes(1);
  });

  it('detaches the room from the audio session before disconnecting it', async () => {
    const joining = service.joinRoom('video_room', 'user-1', false);
    answerJoinRequest();
    await joining;

    service.leaveRoom();

    expect(audioSession.detach).toHaveBeenCalledWith(fakeRoom);
    expect(audioSession.detach.mock.invocationCallOrder[0]).toBeLessThan(
      fakeRoom.disconnect.mock.invocationCallOrder[0],
    );
    expect(fakeRoom.disconnect).toHaveBeenCalledTimes(1);
  });

  it('has nothing to detach when no room is active', () => {
    service.leaveRoom();

    expect(audioSession.detach).not.toHaveBeenCalled();
  });
});
