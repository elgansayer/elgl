import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioPlayerComponent } from '../audio-player/audio-player.component';

export interface MultiMediaMessage {
  text?: string;
  images?: string[];
  voiceNote?: {
    url: string;
    durationSec: number;
  };
}

@Component({
  selector: 'app-media-attachments',
  standalone: true,
  imports: [TranslatePipe, AudioPlayerComponent],
  templateUrl: './media-attachments.component.html',
  styles: [
    `
      .media-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.25rem;
      }

      .media-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 0.5rem;
      }
    `,
  ],
})
export class MediaAttachmentsComponent {
  readonly message = input.required<MultiMediaMessage>();

  readonly images = computed(() => (this.message().images ?? []).slice(0, 9));
  readonly hasText = computed(() => Boolean(this.message().text));
  readonly voiceNote = computed(() => this.message().voiceNote ?? undefined);
  readonly showImages = computed(() => !this.voiceNote() && this.images().length > 0);
}
