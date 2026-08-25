import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SoundboardService } from './soundboard.service';

describe('SoundboardService', () => {
  let service: SoundboardService;
  const mockFetch = vi.fn();
  const getAccessToken = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    getAccessToken.mockReturnValue('access-token');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getAccessToken } }],
    });
    service = TestBed.inject(SoundboardService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
    getAccessToken.mockReset();
  });

  it('authenticates the sound catalogue request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sounds: [
          {
            id: 'applause',
            name: 'Applause',
            url: 'https://media.example.test/soundboard/applause.mp3',
            icon: '👏',
          },
        ],
      }),
    });

    const result = await service.getSounds();

    expect(result.sounds).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/audio-rooms\/soundboard\/list$/),
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer access-token' },
      }),
    );
  });

  it('fails before networking when there is no authenticated session', async () => {
    getAccessToken.mockReturnValue(null);

    await expect(service.getSounds()).rejects.toThrow('Authentication required.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed or unsafe catalogue URLs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sounds: [
          {
            id: 'applause',
            name: 'Applause',
            url: 'javascript:alert(1)',
            icon: '👏',
          },
        ],
      }),
    });

    await expect(service.getSounds()).rejects.toThrow(
      'Soundboard returned an invalid response.',
    );
  });

  it('rejects an unexpectedly large sound catalogue', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sounds: Array.from({ length: 21 }, (_, index) => ({
          id: `sound-${index}`,
          name: `Sound ${index}`,
          url: `https://media.example.test/soundboard/${index}.mp3`,
          icon: '🔊',
        })),
      }),
    });

    await expect(service.getSounds()).rejects.toThrow(
      'Soundboard returned an invalid response.',
    );
  });

  it('posts trimmed room and sound IDs with the bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        soundUrl: 'https://media.example.test/soundboard/applause.mp3',
      }),
    });

    const result = await service.playSound(' room-123 ', ' applause ');

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/audio-rooms\/soundboard\/play$/),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        },
        body: JSON.stringify({ room_id: 'room-123', sound_id: 'applause' }),
      }),
    );
  });

  it('rejects invalid IDs before sending a request', async () => {
    await expect(service.playSound(' ', 'applause')).rejects.toThrow(
      'Invalid soundboard request.',
    );
    await expect(service.playSound('room-1', 'x'.repeat(65))).rejects.toThrow(
      'Invalid soundboard request.',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not expose provider status text when a play request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'secret upstream detail',
    });

    await expect(service.playSound('room-1', 'applause')).rejects.toThrow(
      'Could not play soundboard sound.',
    );
  });

  it('rejects unsafe audio URLs in play responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, soundUrl: 'http://127.0.0.1/private' }),
    });

    await expect(service.playSound('room-1', 'applause')).rejects.toThrow(
      'Soundboard returned an invalid response.',
    );
  });
});
