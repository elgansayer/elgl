import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const MAX_SOUNDS = 20;
const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 80;
const MAX_ICON_LENGTH = 16;
const MAX_ROOM_ID_LENGTH = 128;

export interface SoundItem {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export interface SoundboardListResponse {
  sounds: SoundItem[];
}

export interface PlaySoundResponse {
  success: boolean;
  soundUrl: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SoundboardService {
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/audio-rooms/soundboard`;

  /** Fetch the bounded, server-owned list of available sound effects. */
  async getSounds(): Promise<SoundboardListResponse> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/list`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error('Could not load soundboard sounds.');
    }

    const payload: unknown = await response.json();
    if (!isSoundboardListResponse(payload)) {
      throw new Error('Soundboard returned an invalid response.');
    }
    return payload;
  }

  /**
   * Ask the server to broadcast a catalogued sound to the room. The backend is
   * authoritative for room membership, host/co-host permissions and sound IDs.
   */
  async playSound(
    roomId: string,
    soundId: string,
  ): Promise<PlaySoundResponse> {
    const normalizedRoomId = roomId.trim();
    const normalizedSoundId = soundId.trim();
    if (
      !normalizedRoomId ||
      normalizedRoomId.length > MAX_ROOM_ID_LENGTH ||
      !normalizedSoundId ||
      normalizedSoundId.length > MAX_ID_LENGTH
    ) {
      throw new Error('Invalid soundboard request.');
    }

    const response = await this.authenticatedFetch(`${this.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: normalizedRoomId,
        sound_id: normalizedSoundId,
      }),
    });
    if (!response.ok) {
      throw new Error('Could not play soundboard sound.');
    }

    const payload: unknown = await response.json();
    if (!isPlaySoundResponse(payload)) {
      throw new Error('Soundboard returned an invalid response.');
    }
    return payload;
  }

  private authenticatedFetch(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required.');
    }

    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

function isSoundboardListResponse(value: unknown): value is SoundboardListResponse {
  if (!isRecord(value) || !Array.isArray(value['sounds'])) return false;
  if (value['sounds'].length > MAX_SOUNDS) return false;
  return value['sounds'].every(isSoundItem);
}

function isSoundItem(value: unknown): value is SoundItem {
  if (!isRecord(value)) return false;
  return (
    isBoundedString(value['id'], MAX_ID_LENGTH) &&
    isBoundedString(value['name'], MAX_NAME_LENGTH) &&
    isBoundedString(value['icon'], MAX_ICON_LENGTH) &&
    isSafeAudioUrl(value['url'])
  );
}

function isPlaySoundResponse(value: unknown): value is PlaySoundResponse {
  if (!isRecord(value) || typeof value['success'] !== 'boolean') return false;
  const soundUrl = value['soundUrl'];
  return soundUrl === null || isSafeAudioUrl(soundUrl);
}

function isSafeAudioUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximumLength
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
