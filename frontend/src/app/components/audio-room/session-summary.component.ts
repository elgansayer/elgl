import { Component, inject, input, resource, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioRoomsStore, SessionTranscript } from '../../services/audio-rooms.store';
import { showToast } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-session-summary',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="app-card app-padded space-y-4 mt-4 relative">
      <button
        (click)="dismissed.emit()"
        class="absolute top-2 end-2 text-surface-400 hover:text-white text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-100 transition-colors"
        [attr.aria-label]="'audioRoom.closeSummary' | t"
      >&times;</button>
      <h3 class="text-base font-black text-text-primary pe-8">
        {{ 'audioRoom.sessionSummaryTitle' | t }}
      </h3>

      @if (transcriptResource.isLoading()) {
        <div class="flex items-center justify-center py-6">
          <p class="text-sm text-text-secondary">
            {{ 'audioRoom.sessionSummaryLoading' | t }}
          </p>
        </div>
      }

      @if (transcriptResource.error()) {
        <p class="text-sm text-red-400">{{ 'audioRoom.sessionSummaryEmpty' | t }}</p>
      }

      @if (transcriptResource.value(); as data) {
        @if (data.session_summary) {
          <div class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wide text-text-secondary">
              {{ 'audioRoom.keyTopicsLabel' | t }}
            </h4>
            <div class="rounded-card bg-surface-200 p-4 text-sm text-text-primary whitespace-pre-line">
              {{ data.session_summary }}
            </div>
          </div>
        } @else {
          <p class="text-sm text-text-secondary">{{ 'audioRoom.sessionSummaryEmpty' | t }}</p>
        }

        @if (data.vocabulary.length > 0) {
          <div class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wide text-text-secondary">
              {{ 'audioRoom.keyVocabularyLabel' | t }}
            </h4>
            <div class="flex flex-wrap gap-2">
              @for (word of data.vocabulary; track word) {
                <span
                  class="app-chip cursor-pointer bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 transition-colors"
                  role="button"
                  (click)="onVocabularyClick(word)"
                  [attr.aria-label]="'Add ' + word + ' to vocabulary'"
                >
                  {{ word }}
                  <span class="ms-1 text-[10px]">+</span>
                </span>
              }
            </div>
          </div>
        } @else {
          <p class="text-sm text-text-secondary">{{ 'audioRoom.noVocabulary' | t }}</p>
        }
      }
    </div>
  `,
})
export class SessionSummaryComponent {
  private readonly store = inject(AudioRoomsStore);
  private readonly i18n = inject(I18nService);

  readonly roomId = input.required<string>();
  readonly dismissed = output<void>();

  readonly transcriptResource = resource<SessionTranscript, string>({
    params: () => this.roomId(),
    loader: async ({ params: roomId }) => {
      return this.store.getTranscript(roomId);
    },
  });

  onVocabularyClick(word: string): void {
    showToast(this.i18n.translate('audioRoom.vocabularySavedToast'));
  }
}