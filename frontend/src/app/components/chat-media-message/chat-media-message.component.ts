import { Component, input } from '@angular/core';

interface MediaMessageLike {
  message_type: string;
  media_url?: string;
}

@Component({
  selector: 'app-chat-media-message',
  template: `
    @if (isImage() && safeUrl()) {
      <a
        [href]="safeUrl()"
        target="_blank"
        rel="noopener noreferrer"
        class="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Open shared photo"
      >
        <img
          [src]="safeUrl()"
          loading="lazy"
          decoding="async"
          alt="Shared photo"
          class="max-h-96 max-w-full rounded-xl object-contain"
        />
      </a>
    } @else if (isInstantVideo() && safeUrl()) {
      <div class="max-w-full" aria-label="Instant video note">
        <video
          [src]="safeUrl()"
          controls
          preload="metadata"
          playsinline
          class="aspect-square h-56 w-56 max-h-[70vw] max-w-[70vw] rounded-full bg-black object-cover shadow-lift"
          aria-label="Play instant video note"
        ></video>
      </div>
    } @else if (isVideo() && safeUrl()) {
      <video
        [src]="safeUrl()"
        controls
        preload="metadata"
        playsinline
        class="max-h-96 min-w-52 max-w-full rounded-xl bg-black"
        aria-label="Shared video"
      ></video>
    }
  `,
})
export class ChatMediaMessageComponent {
  readonly message = input.required<MediaMessageLike>();

  isImage(): boolean {
    return this.message().message_type === 'image';
  }

  isVideo(): boolean {
    return this.message().message_type === 'video';
  }

  isInstantVideo(): boolean {
    return this.message().message_type === 'video_note';
  }

  safeUrl(): string | null {
    const raw = this.message().media_url?.trim();
    if (!raw) return null;
    try {
      const url = new URL(raw, globalThis.location?.origin ?? 'https://localhost');
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
