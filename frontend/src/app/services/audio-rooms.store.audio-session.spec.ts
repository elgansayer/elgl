import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as livekitClient from 'livekit-client';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import { AudioRoomRecord, AudioRoomsStore } from './audio-rooms.store';
import { AuthService } from './auth.service';
import { CallAudioSessionService } from './call-audio-session.service';
import { CentrifugeService } from './centrifuge.service';
import { EconomyStore } from './economy.store';
import { I18nService } from './i18n.service';
import { QuickPollService } from './quick-poll.service';

vi.mock('livekit-client');

describe('AudioRoomsStore call audio session wiring', () => {
  const room: AudioRoomRecord = {
    id: 'room-1',
    room_name: 'room-one',
    title: 'Spanish practice',
    target_language: 'es',
    host_id: 'host-1',
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 2,
    created_at: '2026-11-03T00:00:00.000Z',
  };
  let store: AudioRoomsStore;
  let audioSession: { attach: ReturnType<typeof vi.fn>; detach: ReturnType<typeof vi.fn> };
  let liveKitRoom: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    audioSession = { attach: vi.fn(), detach: vi.fn() };
    liveKitRoom = {
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      localParticipant: { setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined) },
    };
    liveKitRoom.on.mockReturnValue(liveKitRoom);
    vi.mocked(livekitClient.Room).mockImplementation(function () {
      return liveKitRoom as unknown as livekitClient.Room;
    });

    TestBed.configureTestingModule({
      providers: [
        AudioRoomsStore,
        { provide: CallAudioSessionService, useValue: audioSession },
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(() => of({})),
            post: vi.fn(() =>
              of({
                token: 'room-token',
                room_id: 'room-1',
                room_name: 'room-one',
                livekit_url: 'wss://livekit.example.test',
                is_speaker: true,
              }),
            ),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'access-token',
            currentUser: signal({ id: 'listener-1' }),
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn(() => null),
            unsubscribe: vi.fn(),
          },
        },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        {
          provide: EconomyStore,
          useValue: { triggerPublicGiftAnimation: vi.fn(), coinsBalance: signal(0) },
        },
        {
          provide: AudioRoomDegradationService,
          useValue: {
            isLiveKitDegraded: signal(false),
            isCentrifugoDegraded: signal(false),
            isSupabaseDegraded: signal(false),
            isFullyOperational: signal(true),
            degradationSummary: signal(null),
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
            refreshHealth: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QuickPollService,
          useValue: { getActivePoll: vi.fn().mockResolvedValue(null) },
        },
      ],
    });
    store = TestBed.inject(AudioRoomsStore);
  });

  afterEach(() => {
    store.leaveRoom();
    vi.clearAllMocks();
  });

  it('attaches the connected room as an audio room session', async () => {
    await store.joinRoom(room);

    expect(audioSession.attach).toHaveBeenCalledTimes(1);
    expect(audioSession.attach).toHaveBeenCalledWith(liveKitRoom, 'room');
  });

  it('attaches after connecting and before publishing the microphone', async () => {
    await store.joinRoom(room);

    const attachedAt = audioSession.attach.mock.invocationCallOrder[0];
    expect(liveKitRoom.connect.mock.invocationCallOrder[0]).toBeLessThan(attachedAt);
    expect(attachedAt).toBeLessThan(
      liveKitRoom.localParticipant.setMicrophoneEnabled.mock.invocationCallOrder[0],
    );
  });

  it('does not attach a room that failed to connect', async () => {
    liveKitRoom.connect.mockRejectedValue(new Error('network unreachable'));

    await store.joinRoom(room);

    expect(audioSession.attach).not.toHaveBeenCalled();
  });

  it('detaches the room from the audio session before disconnecting on leave', async () => {
    await store.joinRoom(room);

    store.leaveRoom();

    expect(audioSession.detach).toHaveBeenCalledWith(liveKitRoom);
    expect(audioSession.detach.mock.invocationCallOrder[0]).toBeLessThan(
      liveKitRoom.disconnect.mock.invocationCallOrder[0],
    );
  });

  it('has nothing to detach when leaving without a LiveKit room', () => {
    store.leaveRoom();

    expect(audioSession.detach).not.toHaveBeenCalled();
  });
});
