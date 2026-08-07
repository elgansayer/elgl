import { Component, inject, TransferState, makeStateKey, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RoomPreview {
  room_name: string;
  language_pair: string;
  topic_tag: string;
}

@Component({
  selector: 'app-voiceroom-preview',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div
        class="max-w-md w-full bg-gray-800 rounded-2xl p-6 shadow-xl text-center border border-gray-700"
      >
        <div
          class="w-20 h-20 bg-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center"
        >
          <span class="text-3xl">🎙️</span>
        </div>
        <h1 class="text-2xl font-bold mb-2">{{ roomName }}</h1>
        <div class="flex justify-center gap-2 mb-6">
          <span class="px-3 py-1 bg-gray-700 rounded-full text-sm font-medium">{{
            languagePair
          }}</span>
          <span
            class="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm font-medium"
            >{{ topicTag }}</span
          >
        </div>
        <p class="text-gray-400 mb-8">
          Join this live audio room to practice your speaking skills!
        </p>
        <a
          [routerLink]="['/audio-rooms']"
          [queryParams]="{ join: roomId }"
          class="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
        >
          Join Room
        </a>
      </div>
    </div>
  `,
})
export class VoiceroomPreviewComponent {
  private meta = inject(Meta);
  private title = inject(Title);
  private http = inject(HttpClient);
  private transferState = inject(TransferState);

  id = input.required<string>();

  roomId = '';
  roomName = 'Loading Room...';
  languagePair = '...';
  topicTag = '...';

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.roomId = id;
      const ROOM_KEY = makeStateKey<RoomPreview>(`room-${id}`);

      if (this.transferState.hasKey(ROOM_KEY)) {
        const room = this.transferState.get(ROOM_KEY, null);
        if (room) {
          this.applyRoomData(room);
          return;
        }
      }

      firstValueFrom(this.http.get<RoomPreview>(`${environment.apiUrl}/audio-rooms/${id}`))
        .then((room) => {
          this.transferState.set(ROOM_KEY, room);
          this.applyRoomData(room);
        })
        .catch((err: unknown) => console.error('Failed to load room preview', err));
    });
  }

  // Extract the data application and meta tag logic into a helper method
  private applyRoomData(room: RoomPreview) {
    this.roomName = room.room_name;
    this.languagePair = room.language_pair;
    this.topicTag = room.topic_tag;

    this.title.setTitle(`${this.roomName} - Live Audio Room`);
    this.meta.updateTag({ property: 'og:title', content: `${this.roomName} - Live Audio Room` });
    this.meta.updateTag({
      property: 'og:description',
      content: `Practice ${this.languagePair} in this live audio room about ${this.topicTag}.`,
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }
}
