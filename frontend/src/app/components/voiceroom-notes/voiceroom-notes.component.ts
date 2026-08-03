import { Component, inject, input, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

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
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-4 bg-surface rounded-lg">
      <h2 class="text-lg font-semibold mb-2">{{ 'voices.notes.title' | t }}</h2>

      @if (notesResource.isLoading()) {
        <p>{{ 'global.loading' | t }}</p>
      } @else if (notesResource.error()) {
        <p class="text-red-400">{{ 'global.error' | t }}</p>
      } @else {
        <ul class="space-y-3">
          @for (note of notesResource.value(); track note.id) {
            <li class="border-s-2 border-primary-500 ps-3 py-2">
              <p class="text-sm font-medium">{{ note.author_name }}</p>
              <p class="text-base">{{ note.content }}</p>
              @if (note.vocabulary) {
                <p class="text-xs text-muted-foreground mt-1">{{ note.vocabulary }}</p>
              }
              <button
                class="text-xs text-red-400 hover:underline mt-1"
                (click)="deleteNote(note.id)"
              >
                {{ 'voices.notes.delete' | t }}
              </button>
            </li>
          }
        </ul>
      }

      <hr class="my-4 border-muted" />

      <form (ngSubmit)="addNote()">
        <label class="block mb-1 text-sm">
          {{ 'voices.notes.content_label' | t }}
          <textarea
            class="w-full border rounded p-2 bg-surface-2"
            rows="3"
            [value]="content()"
            (input)="onContentInput($event)"
          ></textarea>
        </label>

        <label class="block mt-2 mb-1 text-sm">
          {{ 'voices.notes.vocabulary_label' | t }}
          <input
            class="w-full border rounded p-2 bg-surface-2"
            [value]="vocabulary()"
            (input)="onVocabularyInput($event)"
          />
        </label>

        <button
          type="submit"
          class="mt-3 btn-primary"
          [disabled]="isPosting()"
        >
          {{ 'voices.notes.post' | t }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .btn-primary { background: #6366f1; color: #fff; padding: 0.5rem 1rem; border-radius: 0.375rem; }
    .bg-surface { background-color: #1e1e1e; }
    .bg-surface-2 { background-color: #2a2a2a; }
    .border-muted { border-color: #333; }
    .text-muted-foreground { color: #9ca3af; }
    .text-red-400 { color: #f87171; }
  `],
})
export class VoiceroomNotesComponent {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
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
        this.http.get<VoiceRoomNote[]>(`/audio-rooms/${params.roomId}/notes`)
      ),
    defaultValue: [],
  });

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
        this.http.post(`/audio-rooms/${this.roomId()}/notes`, {
          content: c,
          vocabulary: this.vocabulary().trim() || undefined,
        })
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
        this.http.delete(`/audio-rooms/${this.roomId()}/notes/${noteId}`)
      );
      this.refreshCounter.update((value) => value + 1);
    } catch {
      // handled by UI error display
    }
  }
}
