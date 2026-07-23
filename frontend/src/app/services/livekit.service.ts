import { Injectable } from '@angular/core';
import { Room, LocalTrack, RemoteTrack } from 'livekit-client';

@Injectable({
  providedIn: 'root'
})
export class LivekitService {
  onTrackSubscribed?: (track: RemoteTrack, publication: any) => void;

  async joinRoom(roomName: string, userId: string, isVideoCall: boolean): Promise<Room> {
    const room = new Room();
    return room;
  }

  async publishTracks(isVideoCall: boolean): Promise<{ audioTrack: LocalTrack | null, videoTrack: LocalTrack | null }> {
    return { audioTrack: null, videoTrack: null };
  }

  leaveRoom(): void {
    // stub
  }
}
