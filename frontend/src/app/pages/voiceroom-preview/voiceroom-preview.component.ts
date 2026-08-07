import { Component, inject, TransferState, makeStateKey, input, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

interface RoomPreview {
  room_name: string;
  language_pair: string;
  topic_tag: string;
}

const ROOM_PREVIEW_KEY_PREFIX = 'voiceroom-preview-';

@Component({
  selector: 'app-voiceroom-preview',
  imports: [RouterModule],
  template: `
    @if (roomResource.value(); as room) {
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
          <p class="text-gray-400 mb-8">
            Join this live audio room to practice your speaking skills!
          </p>
          <a
            [routerLink]="['/audio-rooms']"
            [queryParams]="{ join: id() }"
            class="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
          >
            Join Room
          </a>
        </div>
      </div>
    } @else if (roomResource.error()) {
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
          <h1 class="text-2xl font-bold mb-2 text-gray-500">Room unavailable</h1>
          <p class="text-gray-500 mb-8">This room may no longer be active.</p>
          <a
            [routerLink]="['/audio-rooms']"
            class="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
          >
            Browse Rooms
          </a>
        </div>
      </div>
    } @else {
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
          <h1 class="text-2xl font-bold mb-2 text-gray-400">Loading Room...</h1>
          <p class="text-gray-400 mb-8">&nbsp;</p>
        </div>
      </div>
    }
  `,
})
export class VoiceroomPreviewComponent {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly http = inject(HttpClient);
  private readonly transferState = inject(TransferState);

  readonly id = input<string>('');

  readonly roomResource = resource<RoomPreview | undefined, string>({
    params: () => this.id(),
    loader: async ({ params: roomId }) => {
      if (!roomId) {
        return undefined;
      }

      const stateKey = makeStateKey<RoomPreview>(`${ROOM_PREVIEW_KEY_PREFIX}${roomId}`);

      if (this.transferState.hasKey(stateKey)) {
        const cached = this.transferState.get(stateKey, null);
        if (cached) {
          this.applyMeta(cached);
          return cached;
        }
      }

      const room = await firstValueFrom(
        this.http.get<RoomPreview>(`${environment.apiUrl}/audio-rooms/${roomId}`),
      );

      this.transferState.set(stateKey, room);
      this.applyMeta(room);
      return room;
    },
  });

  private applyMeta(room: RoomPreview): void {
    const titleText = `${room.room_name} - Live Audio Room`;
    const description = `Practise ${room.language_pair} in this live audio room about ${room.topic_tag}.`;

    this.title.setTitle(titleText);
    this.meta.updateTag({ property: 'og:title', content: titleText });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.addTag({ name: 'description', content: description });
  }
}
