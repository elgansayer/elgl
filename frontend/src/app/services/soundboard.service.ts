import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import {
  BUNDLED_SOUNDBOARD_CLIPS,
  isBundledSoundboardSoundId,
} from './soundboard-clips';

export interface SoundItem {
  id: string;
  name: string;
  icon: string;
}

export interface SoundboardListResponse {
  sounds: SoundItem[];
}

export interface PlaySoundResponse {
  success: true;
}

const MAX_ROOM_ID_LENGTH = 128;
const MAX_SOUND_NAME_LENGTH = 80;
const MAX_ICON_LENGTH = 16;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseRoomId(roomId: string): string {
  const value = roomId.trim();
  if (!value || value.length > MAX_ROOM_ID_LENGTH) {
    throw new Error('Invalid soundboard room');
  }
  return value;
}

@Injectable({
  providedIn: 'root',
})
export class SoundboardService {
  private readonly authService = inject(AuthService);
  private readonly baseUrl = '/api/audio-rooms/soundboard';

  private async apiFetch(path: string, options: RequestInit): Promise<unknown> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error('Soundboard request failed');
    }

    try {
      return await response.json();
    } catch {
      throw new Error('Invalid soundboard response');
    }
  }

  /**
   * Fetches the server-authoritative sound IDs while keeping playback media
   * client-owned. Unknown or malformed catalogue entries are discarded rather
   * than becoming remote media URLs that the browser could be asked to play.
   */
  async getSounds(): Promise<SoundboardListResponse> {
    const payload = await this.apiFetch('/list', { method: 'GET' });
    if (!isRecord(payload) || !Array.isArray(payload['sounds'])) {
      throw new Error('Invalid soundboard response');
    }

    const bundledById = new Map(
      BUNDLED_SOUNDBOARD_CLIPS.map((clip) => [clip.id, clip]),
    );
    const seen = new Set<string>();
    const sounds: SoundItem[] = [];

    for (const item of payload['sounds']) {
      if (!isRecord(item)) continue;
      const id = typeof item['id'] === 'string' ? item['id'].trim() : '';
      if (!isBundledSoundboardSoundId(id) || seen.has(id)) continue;

      const bundled = bundledById.get(id);
      if (!bundled) continue;
      const rawName = typeof item['name'] === 'string' ? item['name'].trim() : '';
      const rawIcon = typeof item['icon'] === 'string' ? item['icon'].trim() : '';
      sounds.push({
        id,
        name:
          rawName && rawName.length <= MAX_SOUND_NAME_LENGTH
            ? rawName
            : bundled.name,
        icon:
          rawIcon && rawIcon.length <= MAX_ICON_LENGTH
            ? rawIcon
            : bundled.icon,
      });
      seen.add(id);
    }

    return { sounds };
  }

  async playSound(
    roomId: string,
    soundId: string,
  ): Promise<PlaySoundResponse> {
    const normalisedRoomId = normaliseRoomId(roomId);
    const normalisedSoundId = soundId.trim();
    if (!isBundledSoundboardSoundId(normalisedSoundId)) {
      throw new Error('Invalid soundboard sound');
    }

    const payload = await this.apiFetch('/play', {
      method: 'POST',
      body: JSON.stringify({
        room_id: normalisedRoomId,
        sound_id: normalisedSoundId,
      }),
    });

    if (!isRecord(payload) || payload['success'] !== true) {
      throw new Error('Invalid soundboard response');
    }

    return { success: true };
  }
}
