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
      providers: [
        SoundboardService,
        { provide: AuthService, useValue: { getAccessToken } },
      ],
    });
    service = TestBed.inject(SoundboardService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
    getAccessToken.mockReset();
  });

  it('authenticates catalogue requests and drops untrusted remote media fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sounds: [
          {
            id: 'applause',
            name: 'Applause',
            icon: '👏',
            url: 'https://attacker.example/track.mp3',
          },
          {
            id: 'unknown',
            name: 'Unknown',
            icon: '!',
            url: 'https://attacker.example/unknown.mp3',
          },
        ],
      }),
    });

    await expect(service.getSounds()).resolves.toEqual({
      sounds: [{ id: 'applause', name: 'Applause', icon: '👏' }],
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/audio-rooms/soundboard/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
    });
  });

  it('uses bundled metadata when server labels are malformed or oversized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sounds: [
          { id: 'laugh', name: 'x'.repeat(81), icon: 'x'.repeat(17) },
          { id: 'laugh', name: 'Duplicate', icon: 'D' },
        ],
      }),
    });

    await expect(service.getSounds()).resolves.toEqual({
      sounds: [{ id: 'laugh', name: 'Laughter', icon: '😂' }],
    });
  });

  it('fails closed without an authenticated session', async () => {
    getAccessToken.mockReturnValue(null);

    await expect(service.getSounds()).rejects.toThrow('Authentication required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed catalogue responses', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ sounds: 'bad' }) });

    await expect(service.getSounds()).rejects.toThrow('Invalid soundboard response');
  });

  it('does not expose arbitrary backend response bodies on request failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'private upstream details',
    });

    await expect(service.getSounds()).rejects.toThrow('Soundboard request failed');
  });

  it('posts an authenticated, validated play request', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await expect(service.playSound(' room-123 ', 'applause')).resolves.toEqual({
      success: true,
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/audio-rooms/soundboard/play', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({ room_id: 'room-123', sound_id: 'applause' }),
    });
  });

  it('rejects unknown sound IDs before network I/O', async () => {
    await expect(service.playSound('room-123', 'https://evil.example/a.mp3')).rejects.toThrow(
      'Invalid soundboard sound',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects empty and overlong room IDs before network I/O', async () => {
    await expect(service.playSound('   ', 'gong')).rejects.toThrow('Invalid soundboard room');
    await expect(service.playSound('r'.repeat(129), 'gong')).rejects.toThrow(
      'Invalid soundboard room',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires an explicit successful server acknowledgement', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) });

    await expect(service.playSound('room-123', 'gong')).rejects.toThrow(
      'Invalid soundboard response',
    );
  });
});
