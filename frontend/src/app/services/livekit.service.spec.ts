import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LivekitService } from './livekit.service';
import { environment } from '../../environments/environment';
import { vi } from 'vitest';
import * as livekitClient from 'livekit-client';

vi.mock('livekit-client', () => ({
  Room: vi.fn(),
  createLocalTracks: vi.fn(),
  ExternalE2EEKeyProvider: vi.fn(),
  LocalTrack: vi.fn(),
  RemoteTrack: vi.fn(),
  RoomOptions: {},
  Track: { Source: { Microphone: 'microphone' } },
}));

/** Exposes the private internals of {@link LivekitService} for testing. */
interface LivekitServiceInternals {
  room: unknown;
  _localAudioTrack: unknown;
  _muted: boolean;
  _speakerphone: boolean;
}

function internals(service: LivekitService): LivekitServiceInternals {
  return service as unknown as LivekitServiceInternals;
}

const mockRoomConnect = vi.fn();
const mockRoomDisconnect = vi.fn();
const mockRoomPublishTrack = vi.fn();
const mockSetMicrophoneEnabled = vi.fn();
const mockGetTrackPublication = vi.fn();

/**
 * `Room` and `LocalTrack` are large third-party classes with many members we
 * never touch in these tests. Rather than sprinkling `as unknown as X` casts
 * at every call site, the minimal shape actually exercised by
 * {@link LivekitService} is described here once and cast in a single,
 * well-typed place.
 */
interface MockRoomShape {
  connect?: typeof mockRoomConnect;
  disconnect?: typeof mockRoomDisconnect;
  localParticipant?: {
    publishTrack: typeof mockRoomPublishTrack;
    setMicrophoneEnabled?: typeof mockSetMicrophoneEnabled;
    getTrackPublication?: typeof mockGetTrackPublication;
  };
}

function mockRoom(shape: MockRoomShape): livekitClient.Room {
  return shape as unknown as livekitClient.Room;
}

interface MockLocalTrackShape {
  kind: 'audio' | 'video';
  isMuted: boolean;
  mute: () => void;
  unmute: () => void;
  getSettings?: () => unknown;
  mediaStreamTrack?: { getSettings: () => unknown; stop: () => void };
}

function mockLocalTrack(shape: MockLocalTrackShape): livekitClient.LocalTrack {
  return shape as unknown as livekitClient.LocalTrack;
}

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

    // Reset all mock functions
    mockRoomConnect.mockReset();
    mockRoomDisconnect.mockReset();
    mockRoomPublishTrack.mockReset();
    mockSetMicrophoneEnabled.mockReset();
    mockGetTrackPublication.mockReset();

    // Default mocked Room constructor
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

    // Default createLocalTracks returns an empty array
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

  describe('getToken', () => {
    it('should POST to the livekit token endpoint', async () => {
      const tokenPromise = service.getToken('my-room', 'user-123');
      const req = httpMock.expectOne(`${environment.apiUrl}/livekit/token`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        room_name: 'my-room',
        participant_identity: 'user-123',
      });
      req.flush({ token: 'test-token' });
      const token = await tokenPromise;
      expect(token).toBe('test-token');
    });
  });

  describe('getLiveKitUrl', () => {
    it('should return the configured LiveKit URL', () => {
      expect(service.getLiveKitUrl()).toBe(environment.liveKitUrl);
    });
  });

  describe('joinRoom', () => {
    it('should connect to a room with the token from the backend', async () => {
      const fakeRoom = mockRoom({
        connect: mockRoomConnect,
        disconnect: mockRoomDisconnect,
      });
      // Override the private createRoom factory so we do not depend on the
      // real livekit-client Room constructor during this test.
      (service as unknown as { createRoom: (options: unknown) => unknown }).createRoom = () => fakeRoom;

      mockRoomConnect.mockImplementation(async () => {});
      const roomPromise = service.joinRoom('my-room', 'user-123', false);
      const req = httpMock.expectOne(`${environment.apiUrl}/livekit/token`);
      expect(req.request.method).toBe('POST');
      req.flush({ token: 'test-token' });
      const room = await roomPromise;
      expect(mockRoomConnect).toHaveBeenCalledWith(
        environment.liveKitUrl,
        'test-token',
        expect.objectContaining({
          rtcConfig: expect.objectContaining({
            iceServers: expect.arrayContaining([
              expect.objectContaining({ urls: expect.stringContaining('stun:') }),
            ]),
          }),
        }),
      );
      expect(room).toBe(fakeRoom);
      expect(internals(service).room).toEqual(fakeRoom);
    });
  });

  describe('publishTracks', () => {
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

  describe('toggleMute', () => {
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

  describe('toggleSpeakerphone', () => {
    it('should flip the speakerphone flag and return the new state', () => {
      internals(service)._speakerphone = false;
      expect(service.toggleSpeakerphone()).toBe(true);
      expect(service.toggleSpeakerphone()).toBe(false);
    });
  });

  describe('leaveRoom', () => {
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
