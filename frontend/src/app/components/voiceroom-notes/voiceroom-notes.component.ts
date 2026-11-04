import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, resource, signal, DestroyRef, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { environment } from '../../../environments/environment';

export interface VoiceRoomNote {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string;
  content: string;
  vocabulary?: string | null;
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
  private readonly centrifugo = inject(CentrifugeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiBase = environment.apiUrl;
  private subscribedRoomId?: string;

  roomId = input.required<string>();
  canPost = input<boolean>(false);
  isHost = input<boolean>(false);
  currentUserId = input<string | undefined>();

  content = signal('');
  vocabulary = signal('');
  isPosting = signal(false);
  errorMessage = signal<string | null>(null);
  deletingNoteId = signal<string | null>(null);

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
        this.centrifugo.unsubscribe('room_' + this.subscribedRoomId);
        this.subscribedRoomId = undefined;
      }

      if (currentRoomId) {
        this.subscribedRoomId = currentRoomId;
        this.centrifugo.subscribe('room_' + currentRoomId, (data: unknown) => {
          if (typeof data !== 'object' || data === null || !('type' in data)) return;
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
        this.centrifugo.unsubscribe('room_' + this.subscribedRoomId);
      }
    });
  }

  canDeleteNote(note: VoiceRoomNote): boolean {
    const uid = this.currentUserId();
    if (!uid) return false;
    return note.author_id === uid || this.isHost();
  }

  parseVocabulary(rawVocab?: string | null): string[] {
    if (!rawVocab) return [];
    return rawVocab
      .split(',')
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
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
    this.errorMessage.set(null);
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
      this.errorMessage.set(this.i18n.translate('voices.notes.errorPosting'));
    } finally {
      this.isPosting.set(false);
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    this.errorMessage.set(null);
    this.deletingNoteId.set(noteId);
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiBase}/audio-rooms/${this.roomId()}/notes/${noteId}`),
      );
      this.refreshCounter.update((value) => value + 1);
    } catch {
      this.errorMessage.set(this.i18n.translate('voices.notes.errorDeleting'));
    } finally {
      this.deletingNoteId.set(null);
    }
  }
}
