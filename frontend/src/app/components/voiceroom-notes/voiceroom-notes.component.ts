<<<<<<< HEAD
import { Component, inject, input, resource, signal, OnInit, OnDestroy } from '@angular/core';
=======
import {
  Component,
  inject,
  input,
  resource,
  signal,
  DestroyRef,
  effect,
} from '@angular/core';
>>>>>>> origin/main
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';

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
<<<<<<< HEAD
  imports: [TranslatePipe, DatePipe],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-surface-100">
        <h3 class="text-sm font-black text-text-primary">
          📝 {{ 'voiceroomNotes.panelTitle' | t }}
        </h3>
        <button
          class="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 transition-colors"
          (click)="showForm.update(v => !v)"
        >
          {{ showForm() ? ('voiceroomNotes.cancelBtn' | t) : ('voiceroomNotes.addNoteBtn' | t) }}
        </button>
      </div>

      @if (showForm()) {
        <form (ngSubmit)="addNote()" class="mb-3 p-3 rounded-xl bg-surface-200 border border-surface-100">
          <label class="block mb-1.5 text-[11px] font-bold text-text-secondary">
            {{ 'voiceroomNotes.contentLabel' | t }}
            <textarea
              class="w-full border border-surface-100 rounded-lg p-2.5 bg-surface-300 text-text-primary text-xs resize-none focus:outline-none focus:border-purple-500 transition-colors"
              rows="3"
              placeholder="{{ 'voiceroomNotes.contentPlaceholder' | t }}"
              [value]="content()"
              (input)="onContentInput($event)"
            ></textarea>
          </label>

          <label class="block mt-2 mb-1.5 text-[11px] font-bold text-text-secondary">
            {{ 'voiceroomNotes.vocabularyLabel' | t }}
            <input
              class="w-full border border-surface-100 rounded-lg p-2.5 bg-surface-300 text-text-primary text-xs focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="{{ 'voiceroomNotes.vocabularyPlaceholder' | t }}"
              [value]="vocabulary()"
              (input)="onVocabularyInput($event)"
            />
          </label>

          <div class="flex gap-2 mt-3">
            <button
              type="submit"
              class="app-button-primary ps-4 pe-4 pt-2 pb-2 text-xs flex-1"
              [disabled]="isPosting()"
            >
              {{ isPosting() ? ('voiceroomNotes.postingBtn' | t) : ('voiceroomNotes.postBtn' | t) }}
            </button>
            <button
              type="button"
              class="app-button-secondary ps-3 pe-3 pt-2 pb-2 text-xs"
              (click)="showForm.set(false)"
            >
              {{ 'voiceroomNotes.cancelBtn' | t }}
            </button>
          </div>
        </form>
      }

      <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
        @if (notesResource.isLoading()) {
          <div class="text-center py-8 text-text-muted text-xs">
            {{ 'global.loading' | t }}
          </div>
        } @else if (notesResource.error()) {
          <div class="text-center py-8 text-red-400 text-xs">
            {{ 'global.error' | t }}
          </div>
        } @else {
          @for (note of notesResource.value(); track note.id) {
            <div
              class="p-3 rounded-xl bg-surface-200 border border-surface-100 hover:border-purple-500/30 transition-colors"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-bold text-[11px] text-purple-300">{{ note.author_name }}</span>
                <span class="text-[9px] text-text-muted">{{ note.created_at | date:'shortTime' }}</span>
              </div>
              <p class="text-sm text-text-primary break-words">{{ note.content }}</p>
              @if (note.vocabulary) {
                <div class="mt-2 flex flex-wrap gap-1">
                  @for (word of tokeniseVocabulary(note.vocabulary); track word) {
                    <span class="app-chip bg-indigo-500/15 text-indigo-300 text-[10px]">
                      {{ word }}
                    </span>
                  }
                </div>
              }
              <button
                class="text-[10px] text-red-400/70 hover:text-red-400 hover:underline mt-1.5 transition-colors"
                (click)="deleteNote(note.id)"
              >
                {{ 'voiceroomNotes.deleteBtn' | t }}
              </button>
            </div>
          } @empty {
            <div class="text-center py-12 text-text-muted">
              <p class="text-2xl mb-2">📝</p>
              <p class="text-xs">{{ 'voiceroomNotes.emptyState' | t }}</p>
              <p class="text-[10px] mt-1 opacity-70">{{ 'voiceroomNotes.emptyHint' | t }}</p>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
  `],
=======
  imports: [TranslatePipe],
  templateUrl: './voiceroom-notes.component.html',
  styleUrls: ['./voiceroom-notes.component.css'],
>>>>>>> origin/main
})
export class VoiceroomNotesComponent {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private centrifugo = inject(CentrifugoService);
<<<<<<< HEAD
  private injector = inject(Injector);
  readonly roomId = input<string>('');
=======
  private destroyRef = inject(DestroyRef);
  private subscribedRoomId?: string;

  roomId = input.required<string>();
>>>>>>> origin/main

  content = signal('');
  vocabulary = signal('');
  isPosting = signal(false);
  showForm = signal(false);

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

  constructor() {
<<<<<<< HEAD
    // Subscribe/unsubscribe to Centrifugo channel for real-time note updates
    // This is an exception to the "no effect for side effects" rule (allowed per AGENTS.md §5.3)
    effect(
      (onCleanup) => {
        const id = this.roomId();
        if (!id) return;

        this.centrifugo.subscribe(`room_${id}`, (data: unknown) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            (data as Record<string, unknown>)['type'] === 'voice_room_note'
          ) {
            this.refreshCounter.update((value) => value + 1);
          }
        });

        onCleanup(() => {
          this.centrifugo.unsubscribe(`room_${id}`);
        });
      },
      { injector: this.injector },
    );
  }

  tokeniseVocabulary(text: string): string[] {
    return text.split(',').map((w) => w.trim()).filter(Boolean);
=======
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
>>>>>>> origin/main
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
        this.http.post(`/audio-rooms/${this.roomId()}/notes`, {
          content: c,
          vocabulary: this.vocabulary().trim() || undefined,
        })
      );
      this.content.set('');
      this.vocabulary.set('');
      this.refreshCounter.update((value) => value + 1);
      this.showForm.set(false);
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
