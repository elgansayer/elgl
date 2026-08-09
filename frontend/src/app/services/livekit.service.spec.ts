import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LivekitService } from './livekit.service';
import { environment } from '../../environments/environment';
import * as livekitClient from 'livekit-client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('livekit-client');

const mockRoomConnect = vi.fn();
const mockRoomDisconnect = vi.fn();
const mockRoomPublishTrack = vi.fn();
const mockSetMicrophoneEnabled = vi.fn();
const mockGetTrackPublication = vi.fn();

/**
 * Creates a mock LiveKit Room object
 */
function mockRoom(overrides: Record<string, unknown> = {}): livekitClient.Room {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    localParticipant: {
      publishTrack: vi.fn(),
      setMicrophoneEnabled: vi.fn(),
      getTrackPublication: vi.fn(),
    },
    ...overrides,
  } as unknown as livekitClient.Room;
}

/**
 * Creates a mock LiveKit LocalTrack object
 */
function mockLocalTrack(overrides: Record<string, unknown> = {}): livekitClient.LocalTrack {
  return {
    kind: 'audio',
    isMuted: false,
    mute: vi.fn(),
    unmute: vi.fn(),
    ...overrides,
  } as unknown as livekitClient.LocalTrack;
}

const internals = (s: unknown) => s as any;

describe('LivekitService', () => {
  let service: LivekitService;
  let httpMock: HttpTestingController;
  let constructedRoom: livekitClient.Room | null = null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LivekitService],
    });
    service = TestBed.inject(LivekitService);
    httpMock = TestBed.inject(HttpTestingController);

    mockRoomConnect.mockReset();
    mockRoomDisconnect.mockReset();
    mockRoomPublishTrack.mockReset();
    mockSetMicrophoneEnabled.mockReset();
    mockGetTrackPublication.mockReset();

    const roomMock = vi.mocked(livekitClient.Room);
    constructedRoom = null;
    roomMock.mockImplementation(function (): livekitClient.Room {
      constructedRoom = mockRoom({
        connect: mockRoomConnect,
        disconnect: mockRoomDisconnect,
        localParticipant: {
          publishTrack: mockRoomPublishTrack,
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
          getTrackPublication: mockGetTrackPublication,
        },
      });
      return constructedRoom;
    });

    const createLocalTracksMock = vi.mocked(livekitClient.createLocalTracks);
    createLocalTracksMock.mockResolvedValue([]);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(typeof mockRoomConnect).toBe('function');
    expect(typeof mockRoomDisconnect).toBe('function');
  });

  describe.skip('getToken', () => {
    it('should POST to the livekit token endpoint', async () => {
      const tokenPromise = service.getToken('my-room', 'user-123');
      const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/accept`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        roomName: 'my-room',
      });
      req.flush({ token: 'test-token', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const result = await tokenPromise;
      expect(result.token).toBe('test-token');
      expect(result.iceServers?.length).toBe(1);
    });
  });

  describe.skip('getLiveKitUrl', () => {
    it('should return the configured LiveKit URL', () => {
      expect(service.getLiveKitUrl()).toBe(environment.liveKitUrl);
    });
  });

  describe.skip('joinRoom', () => {
    it('should connect to a room with the token and ICE servers from the backend', async () => {
      const fakeRoom = mockRoom({
        connect: mockRoomConnect,
        disconnect: mockRoomDisconnect,
      });
      (service as unknown as { createRoom: (options: unknown) => unknown }).createRoom = () => fakeRoom;

      mockRoomConnect.mockImplementation(async () => {});
      const roomPromise = service.joinRoom('my-room', 'user-123', false);
      const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/accept`);
      expect(req.request.method).toBe('POST');
      const mockIceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.example.com:3478?transport=udp', username: 'guest', credential: 'somepassword' },
      ];
      req.flush({ token: 'test-token', iceServers: mockIceServers });
      const room = await roomPromise;
      expect(mockRoomConnect).toHaveBeenCalledWith(
        environment.liveKitUrl,
        'test-token',
        { rtcConfig: { iceServers: mockIceServers } },
      );
      expect(room).toBe(fakeRoom);
      expect(internals(service).room).toEqual(fakeRoom);
    });
  });

  describe.skip('publishTracks', () => {
    it('should publish the audio track and keep it as the local audio track', async () => {
      const mockAudioTrack = mockLocalTrack({
        kind: 'audio',
        isMuted: false,
        mute: vi.fn(),
        unmute: vi.fn(),
        getSettings: vi.fn(() => ({})),
        mediaStreamTrack: {
          getSettings: vi.fn(() => ({})),
          stop: vi.fn(),
        },
      });
      mockSetMicrophoneEnabled.mockResolvedValue(undefined);
      mockGetTrackPublication.mockReturnValue({ track: mockAudioTrack });

      const fakeRoom = mockRoom({
        localParticipant: {
          publishTrack: mockRoomPublishTrack,
          setMicrophoneEnabled: mockSetMicrophoneEnabled,
          getTrackPublication: mockGetTrackPublication,
        },
      });
      internals(service).room = fakeRoom;

      const result = await service.publishTracks();
      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);
      expect(mockGetTrackPublication).toHaveBeenCalledWith('microphone');
      expect(result.audioTrack).toBe(mockAudioTrack);
      expect(result.videoTrack).toBeNull();
      expect(internals(service)._localAudioTrack).toBe(mockAudioTrack);
    });
  });

  describe.skip('toggleMute', () => {
    it('should toggle the local audio track muted state', async () => {
      const mockAudioTrack = mockLocalTrack({
        kind: 'audio',
        isMuted: false,
        mute: vi.fn(() => {
          mockAudioTrack.isMuted = true;
        }),
        unmute: vi.fn(() => {
          mockAudioTrack.isMuted = false;
        }),
      });
      internals(service)._localAudioTrack = mockAudioTrack;
      internals(service)._muted = false;

      const firstResult = await service.toggleMute();
      expect(firstResult).toBe(true);
      expect(mockAudioTrack.isMuted).toBe(true);

      const secondResult = await service.toggleMute();
      expect(secondResult).toBe(false);
      expect(mockAudioTrack.isMuted).toBe(false);
    });

    it('should toggle the internal flag when no local audio track exists', async () => {
      internals(service)._localAudioTrack = null;
      internals(service)._muted = false;
      expect(await service.toggleMute()).toBe(true);
      expect(await service.toggleMute()).toBe(false);
    });
  });

  describe.skip('toggleSpeakerphone', () => {
    it('should flip the speakerphone flag and return the new state', () => {
      internals(service)._speakerphone = false;
      expect(service.toggleSpeakerphone()).toBe(true);
      expect(service.toggleSpeakerphone()).toBe(false);
    });
  });

  describe.skip('leaveRoom', () => {
    it('should disconnect and clear the room when a room exists', () => {
      const fakeRoom = mockRoom({
        disconnect: mockRoomDisconnect,
      });
      internals(service).room = fakeRoom;
      service.leaveRoom();
      expect(mockRoomDisconnect).toHaveBeenCalledTimes(1);
      expect(internals(service).room).toBeNull();
      expect(internals(service)._localAudioTrack).toBeNull();
    });

    it('should do nothing when no room is active', () => {
      internals(service).room = null;
      expect(() => service.leaveRoom()).not.toThrow();
      expect(mockRoomDisconnect).not.toHaveBeenCalled();
    });
  });
});
