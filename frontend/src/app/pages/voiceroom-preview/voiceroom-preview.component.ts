import { Component, inject, input, resource, TransferState, makeStateKey } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
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
    <div
      class="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4"
    >
      <div
        class="max-w-md w-full bg-gray-800 rounded-2xl p-6 shadow-xl text-center border border-gray-700"
      >
        <div
          class="w-20 h-20 bg-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center"
        >
          <span class="text-3xl">🎙️</span>
        </div>
        @if (room.value(); as room) {
          <h1 class="text-2xl font-bold mb-2">{{ room.room_name }}</h1>
          <div class="flex justify-center gap-2 mb-6">
            <span class="px-3 py-1 bg-gray-700 rounded-full text-sm font-medium">{{
              room.language_pair
            }}</span>
            <span
              class="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm font-medium"
              >{{ room.topic_tag }}</span
            >
          </div>
        } @else if (room.error()) {
          <h1 class="text-2xl font-bold mb-2 text-gray-500">Room unavailable</h1>
          <p class="text-gray-500 mb-8">This room may no longer be active.</p>
        } @else {
          <h1 class="text-2xl font-bold mb-2 text-gray-400">Loading Room...</h1>
          <p class="text-gray-400 mb-8">&nbsp;</p>
        }
        <p class="text-gray-400 mb-8">
          Join this live audio room to practice your speaking skills!
        </p>
        <a
          [routerLink]="['/audio-rooms']"
          [queryParams]="{ join: roomId() }"
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
  private transferState = inject(TransferState);

  id = input.required<string>();

  room = resource<RoomPreview, string>({
    params: () => this.id(),
    loader: async ({ params: id }) => {
      const ROOM_KEY = makeStateKey<RoomPreview>(`room-${id}`);

      if (this.transferState.hasKey(ROOM_KEY)) {
        const cached = this.transferState.get(ROOM_KEY, null);
        if (cached) {
          this.applyMetaTags(cached);
          return cached;
        }
      }

      const response = await fetch(
        `${environment.apiUrl}/audio-rooms/preview/${id}`,
      );

      if (!response.ok) throw new Error('Failed to load room preview');

      const room = (await response.json()) as RoomPreview;
      this.transferState.set(ROOM_KEY, room);
      this.applyMetaTags(room);
      return room;
    },
  });

  roomId = this.id;

  private applyMetaTags(room: RoomPreview) {
    const titleText = `${room.room_name} - Live Audio Room`;
    this.title.setTitle(titleText);
    this.meta.updateTag({ property: 'og:title', content: titleText });
    this.meta.updateTag({
      property: 'og:description',
      content: `Practice ${room.language_pair} in this live audio room about ${room.topic_tag}.`,
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }
}
