import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, resource, signal, DestroyRef, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { environment } from '../../../environments/environment';

interface VoiceRoomNote {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string;
  content: string;
  vocabulary?: string;
  created_at: string;
}

@Component({
  selector: 'app-voiceroom-notes',
  imports: [HlmTextarea, HlmInput, HlmButton, TranslatePipe],
  templateUrl: './voiceroom-notes.component.html',
  styleUrls: ['./voiceroom-notes.component.css'],
})
export class VoiceroomNotesComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly centrifugo = inject(CentrifugoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiBase = environment.apiUrl;
  private subscribedRoomId?: string;

  roomId = input.required<string>();

  content = signal('');
  vocabulary = signal('');
  isPosting = signal(false);

  private readonly refreshCounter = signal(0);

  readonly notesResource = resource({
    params: () => ({
      roomId: this.roomId(),
      refreshKey: this.refreshCounter(),
    }),
    loader: ({ params }) =>
      firstValueFrom(
        this.http.get<VoiceRoomNote[]>(`${this.apiBase}/audio-rooms/${params.roomId}/notes`),
      ),
    defaultValue: [],
  });

  constructor() {
    effect(() => {
      const currentRoomId = this.roomId();
      if (this.subscribedRoomId && this.subscribedRoomId !== currentRoomId) {
        this.centrifugo.unsubscribeLiveRoom(this.subscribedRoomId);
        this.subscribedRoomId = undefined;
      }

      if (currentRoomId) {
        this.subscribedRoomId = currentRoomId;
        this.centrifugo.subscribeLiveRoom(currentRoomId, (data) => {
          if (data.type === 'voice_room_note') {
            this.refreshCounter.update((value) => value + 1);
          } else if (data.type === 'voice_room_note_deleted') {
            this.refreshCounter.update((value) => value + 1);
          }
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.subscribedRoomId) {
        this.centrifugo.unsubscribeLiveRoom(this.subscribedRoomId);
      }
    });
  }

  onContentInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.content.set(target.value);
    }
  }

  onVocabularyInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.vocabulary.set(target.value);
    }
  }

  async addNote(): Promise<void> {
    const c = this.content().trim();
    if (!c) return;
    this.isPosting.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.apiBase}/audio-rooms/${this.roomId()}/notes`, {
          content: c,
          vocabulary: this.vocabulary().trim() || undefined,
        }),
      );
      this.content.set('');
      this.vocabulary.set('');
      this.refreshCounter.update((value) => value + 1);
    } catch {
      // handled by UI error display
    } finally {
      this.isPosting.set(false);
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiBase}/audio-rooms/${this.roomId()}/notes/${noteId}`),
      );
      this.refreshCounter.update((value) => value + 1);
    } catch {
      // handled by UI error display
    }
  }
}
