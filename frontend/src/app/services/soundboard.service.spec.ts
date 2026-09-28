import { TestBed } from '@angular/core/testing';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  SoundboardService,
  SoundboardListResponse,
  PlaySoundResponse,
} from './soundboard.service';

describe('SoundboardService', () => {
  let service: SoundboardService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    TestBed.configureTestingModule({});
    service = TestBed.inject(SoundboardService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getSounds', () => {
    it('should call GET /api/audio-rooms/soundboard/list and return the response', async () => {
      const soundList: SoundboardListResponse = {
        sounds: [
          {
            id: '1',
            name: 'Applause',
            url: 'https://example.com/applause.mp3',
            icon: '👏',
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => soundList,
      });

      const result = await service.getSounds();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/audio-rooms/soundboard/list', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(soundList);
    });

    it('should throw an error when the request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(service.getSounds()).rejects.toThrow(
        'Failed to load sounds: Internal Server Error',
      );
    });

    it('should return an empty list when the API returns no sounds', async () => {
      const emptyList: SoundboardListResponse = { sounds: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => emptyList,
      });

      const result = await service.getSounds();

      expect(result).toEqual(emptyList);
    });

    it('should throw an error when the network request rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(service.getSounds()).rejects.toThrow('Network Error');
    });
  });

  describe('playSound', () => {
    it('should POST the room and sound ids and return the response', async () => {
      const playResult: PlaySoundResponse = {
        success: true,
        soundUrl: 'https://example.com/applause.mp3',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => playResult,
      });

      const result = await service.playSound('room-123', 'sound-456');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/audio-rooms/soundboard/play',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: 'room-123',
            sound_id: 'sound-456',
          }),
        },
      );
      expect(result).toEqual(playResult);
    });

    it('should throw an error when the request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(
        service.playSound('room-123', 'sound-456'),
      ).rejects.toThrow('Failed to play sound: Bad Request');
    });

    it('should return the response when success is false', async () => {
      const playResult: PlaySoundResponse = {
        success: false,
        soundUrl: null,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => playResult,
      });

      const result = await service.playSound('room-123', 'sound-456');

      expect(result).toEqual(playResult);
    });

    it('should throw an error when the network request rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        service.playSound('room-123', 'sound-456'),
      ).rejects.toThrow('Network Error');
    });
  });
});
