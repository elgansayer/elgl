import { Component, inject, resource, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioRoomArchivesService } from '../../services/audio-room-archives.service';

@Component({
  selector: 'app-audio-room-archive',
  imports: [HlmButton, TranslatePipe],
  template: `
    <main class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6" aria-live="polite">
      <header class="flex flex-col gap-2">
        <h1 class="text-2xl font-bold text-text-primary">{{ 'chatRoom.transcriptLabel' | t }}</h1>
        <p class="text-sm text-text-secondary">{{ 'audioRoom.roomEndedToast' | t }}</p>
      </header>

      @if (archives.isLoading()) {
        <p role="status" class="rounded-app bg-surface-200 p-4 text-sm text-text-secondary">
          {{ 'common.loading' | t }}
        </p>
      } @else if (archives.error()) {
        <div role="alert" class="rounded-app border border-danger/40 bg-surface-200 p-4">
          <p class="text-sm text-danger">{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" class="mt-3" (click)="archives.reload()">
            {{ 'discovery.retrySearch' | t }}
          </button>
        </div>
      } @else if ((archives.value()?.length ?? 0) === 0) {
        <p class="rounded-app bg-surface-200 p-4 text-sm text-text-secondary">
          {{ 'chatRoom.transcriptEmpty' | t }}
        </p>
      } @else {
        <section
          class="grid gap-3 md:grid-cols-2"
          [attr.aria-label]="'chatRoom.transcriptLabel' | t"
        >
          @for (room of archives.value() ?? []; track room.id) {
            <article
              class="flex flex-col gap-3 rounded-app border border-outline bg-surface-200 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="truncate font-semibold text-text-primary">{{ room.title }}</h2>
                  @if (room.language_pair) {
                    <p class="mt-1 text-xs text-text-secondary">{{ room.language_pair }}</p>
                  }
                  @if (room.topic_tag) {
                    <p class="mt-1 text-xs text-text-secondary">{{ room.topic_tag }}</p>
                  }
                </div>
                @if (room.summary_status === 'pending' || room.summary_status === 'processing') {
                  <span class="rounded-full bg-surface-100 px-2 py-1 text-xs text-text-secondary">
                    {{ 'common.loading' | t }}
                  </span>
                }
              </div>

              <button
                hlmBtn
                type="button"
                class="self-start"
                (click)="selectRoom(room.id)"
                [attr.aria-label]="('common.preview' | t) + ' ' + room.title"
              >
                {{ 'common.preview' | t }}
              </button>
            </article>
          }
        </section>
      }

      @if (selectedRoomId()) {
        <section
          class="rounded-app border border-outline bg-surface-200 p-4 md:p-6"
          [attr.aria-label]="'stats.myStats.summary' | t"
        >
          @if (summary.isLoading()) {
            <p role="status" class="text-sm text-text-secondary">{{ 'common.loading' | t }}</p>
          } @else if (summary.error()) {
            <div role="alert" class="flex flex-wrap items-center gap-3">
              <p class="text-sm text-danger">{{ 'common.error_generic' | t }}</p>
              <button hlmBtn type="button" (click)="summary.reload()">
                {{ 'discovery.retrySearch' | t }}
              </button>
            </div>
          } @else if (summary.value(); as item) {
            @if (item.summary_status === 'pending' || item.summary_status === 'processing') {
              <div class="flex flex-wrap items-center gap-3" role="status">
                <p class="text-sm text-text-secondary">{{ 'common.loading' | t }}</p>
                <button hlmBtn type="button" variant="outline" (click)="summary.reload()">
                  {{ 'vocabDisplay.refresh' | t }}
                </button>
              </div>
            } @else if (item.summary_status === 'failed') {
              <div role="alert" class="flex flex-wrap items-center gap-3">
                <p class="text-sm text-danger">{{ 'common.error_generic' | t }}</p>
                @if (item.can_retry) {
                  <button
                    hlmBtn
                    type="button"
                    [disabled]="retrying()"
                    (click)="retry(item.room_id)"
                  >
                    {{ 'discovery.retrySearch' | t }}
                  </button>
                }
              </div>
            } @else {
              <div class="flex flex-col gap-5">
                @if (item.recording_url) {
                  <audio
                    class="w-full"
                    controls
                    preload="metadata"
                    [src]="item.recording_url"
                    [attr.aria-label]="'audioIntro.play' | t"
                  ></audio>
                }

                <section class="flex flex-col gap-2">
                  <h2 class="text-lg font-semibold text-text-primary">
                    {{ 'stats.myStats.summary' | t }}
                  </h2>
                  @if (item.session_summary) {
                    <p class="whitespace-pre-line text-sm leading-6 text-text-primary">
                      {{ item.session_summary }}
                    </p>
                  } @else {
                    <p class="text-sm text-text-secondary">{{ 'chatRoom.transcriptEmpty' | t }}</p>
                  }
                </section>

                @if (item.vocabulary.length > 0) {
                  <section class="flex flex-col gap-2">
                    <h2 class="text-lg font-semibold text-text-primary">
                      {{ 'voices.notes.vocabulary_label' | t }}
                    </h2>
                    <ul class="flex flex-wrap gap-2">
                      @for (word of item.vocabulary; track word) {
                        <li class="rounded-full bg-primary/15 px-3 py-1 text-sm text-text-primary">
                          {{ word }}
                        </li>
                      }
                    </ul>
                  </section>
                }

                @if (item.transcript_text) {
                  <details class="rounded-app bg-surface-100 p-3">
                    <summary class="cursor-pointer font-medium text-text-primary">
                      {{ 'chatRoom.transcriptLabel' | t }}
                    </summary>
                    <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                      {{ item.transcript_text }}
                    </p>
                  </details>
                }
              </div>
            }
          }
        </section>
      }
    </main>
  `,
})
export class AudioRoomArchiveComponent {
  private readonly archiveService = inject(AudioRoomArchivesService);

  readonly selectedRoomId = signal<string | null>(null);
  readonly retrying = signal(false);

  readonly archives = resource({
    loader: () => this.archiveService.list(),
  });

  readonly summary = resource({
    params: () => this.selectedRoomId(),
    loader: ({ params }) =>
      params ? this.archiveService.getSummary(params) : Promise.resolve(null),
  });

  selectRoom(roomId: string): void {
    this.selectedRoomId.set(roomId);
  }

  async retry(roomId: string): Promise<void> {
    if (this.retrying()) return;
    this.retrying.set(true);
    try {
      await this.archiveService.retry(roomId);
      this.summary.reload();
      this.archives.reload();
    } finally {
      this.retrying.set(false);
    }
  }
}
