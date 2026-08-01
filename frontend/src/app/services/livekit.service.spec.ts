import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LivekitService } from './livekit.service';
import { environment } from '../../environments/environment';
import { vi } from 'vitest';
import { Room } from 'livekit-client';

const { mockRoomConnect, mockRoomDisconnect, mockRoomPublishTrack, mockSetKey, mockCreateLocalTracks } =
  vi.hoisted(() => ({
    mockRoomConnect: vi.fn(),
    mockRoomDisconnect: vi.fn(),
    mockRoomPublishTrack: vi.fn(),
    mockSetKey: vi.fn(),
    mockCreateLocalTracks: vi.fn(),
  }));

vi.mock('livekit-client', () => {
  class MockRoom {
    localParticipant = { publishTrack: mockRoomPublishTrack };
    connect = mockRoomConnect;
    disconnect = mockRoomDisconnect;
    constructor(public options?: object) {}
  }
  return {
    Room: MockRoom,
    LocalTrack: class LocalTrack {},
    RemoteTrack: class RemoteTrack {},
    RoomOptions: {},
    createLocalTracks: mockCreateLocalTracks,
    ExternalE2EEKeyProvider: vi.fn().mockImplementation(() => ({
      setKey: mockSetKey,
    })),
  };
});

describe('LivekitService', () => {
  let service: LivekitService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LivekitService],
    });
    service = TestBed.inject(LivekitService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(typeof mockCreateLocalTracks).toBe('function');
    expect(typeof mockSetKey).toBe('function');
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
      mockRoomConnect.mockResolvedValue(undefined);
      const roomPromise = service.joinRoom('my-room', 'user-123', false);
      const req = httpMock.expectOne(`${environment.apiUrl}/livekit/token`);
      expect(req.request.method).toBe('POST');
      req.flush({ token: 'test-token' });
      const room = await roomPromise;
      expect(mockRoomConnect).toHaveBeenCalledWith(environment.liveKitUrl, 'test-token');
      expect(room).toBeInstanceOf(Room);
      expect((service as any).room).toBe(room);
    });
  });

  describe('publishTracks', () => {
    it('should publish the audio track and keep it as the local audio track', async () => {
      const mockAudioTrack = {
        kind: 'audio' as const,
        isMuted: false,
        mute: vi.fn(),
        unmute: vi.fn(),
        getSettings: vi.fn(() => ({})),
        mediaStreamTrack: {
          getSettings: vi.fn(() => ({})),
          stop: vi.fn(),
        },
      };
      mockCreateLocalTracks.mockResolvedValue([mockAudioTrack]);
      const fakeRoom = new Room();
      (service as any).room = fakeRoom;
      const result = await service.publishTracks();
      expect(mockRoomPublishTrack).toHaveBeenCalledWith(mockAudioTrack);
      expect(result.audioTrack).toBe(mockAudioTrack);
      expect(result.videoTrack).toBeNull();
      expect((service as any)._localAudioTrack).toBe(mockAudioTrack);
    });
  });

  describe('toggleMute', () => {
    it('should toggle the local audio track muted state', async () => {
      const mockAudioTrack = {
        kind: 'audio' as const,
        isMuted: false,
        mute: vi.fn(() => {
          mockAudioTrack.isMuted = true;
        }),
        unmute: vi.fn(() => {
          mockAudioTrack.isMuted = false;
        }),
      };
      (service as any)._localAudioTrack = mockAudioTrack;
      (service as any)._muted = false;

      const firstResult = await service.toggleMute();
      expect(firstResult).toBe(true);
      expect(mockAudioTrack.isMuted).toBe(true);

      const secondResult = await service.toggleMute();
      expect(secondResult).toBe(false);
      expect(mockAudioTrack.isMuted).toBe(false);
    });

    it('should toggle the internal flag when no local audio track exists', async () => {
      (service as any)._localAudioTrack = null;
      (service as any)._muted = false;
      expect(await service.toggleMute()).toBe(true);
      expect(await service.toggleMute()).toBe(false);
    });
  });

  describe('toggleSpeakerphone', () => {
    it('should flip the speakerphone flag and return the new state', () => {
      (service as any)._speakerphone = false;
      expect(service.toggleSpeakerphone()).toBe(true);
      expect(service.toggleSpeakerphone()).toBe(false);
    });
  });

  describe('leaveRoom', () => {
    it('should disconnect and clear the room when a room exists', () => {
      const fakeRoom = new Room();
      (service as any).room = fakeRoom;
      service.leaveRoom();
      expect(mockRoomDisconnect).toHaveBeenCalledTimes(1);
      expect((service as any).room).toBeNull();
      expect((service as any)._localAudioTrack).toBeNull();
    });

    it('should do nothing when no room is active', () => {
      (service as any).room = null;
      expect(() => service.leaveRoom()).not.toThrow();
      expect(mockRoomDisconnect).not.toHaveBeenCalled();
    });
  });
});
