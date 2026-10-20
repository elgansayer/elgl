import { Injectable } from '@angular/core';

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
  private baseUrl = '/api/audio-rooms/soundboard';

  /**
   * Fetch the list of available sound effects.
   */
  async getSounds(): Promise<SoundboardListResponse> {
    const response = await fetch(`${this.baseUrl}/list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load sounds: ${response.statusText}`);
    }
    const data: SoundboardListResponse = await response.json();
    return data;
  }

  /**
   * Instruct the server to play a sound inside the given audio room.
   * The server broadcasts a `soundboard_play` Centrifugo event to all
   * room participants.
   */
  async playSound(
    roomId: string,
    soundId: string,
  ): Promise<PlaySoundResponse> {
    const response = await fetch(`${this.baseUrl}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        sound_id: soundId,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to play sound: ${response.statusText}`);
    }
    const result: PlaySoundResponse = await response.json();
    return result;
  }
}
