import { Component, input, signal } from '@angular/core';
import { UploadedChatMedia } from '../../services/chat-media.service';
import { ChatMediaMessageService } from '../../services/chat-media-message.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { ChatMediaPickerComponent } from '../chat-media-picker/chat-media-picker.component';

@Component({
  selector: 'app-chat-media-share',
  imports: [
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
    ChatMediaPickerComponent,
  ],
  template: `
    <app-button-secondary
      type="button"
      (clicked)="open.set(true)"
      customClass="bg-secondary/20 text-secondary ps-3 pe-3 pt-1.5 pb-1.5 text-xs"
      ariaLabel="Share a photo or video"
    >
      📷 Media
    </app-button-secondary>

    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Share a photo or video"
      >
        <app-chat-media-picker
          (uploaded)="onUploaded($event)"
          (cancelled)="open.set(false)"
        ></app-chat-media-picker>
      </div>
    }

    @if (sendError() && pendingMedia()) {
      <div
        class="basis-full rounded-card border border-danger/30 bg-danger/10 p-2 text-xs text-text-primary"
        role="alert"
        aria-live="polite"
      >
        <p>{{ sendError() }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <app-button-primary
            type="button"
            (clicked)="retryPending()"
            [disabled]="isSending()"
            customClass="min-h-11 px-3 text-xs"
            ariaLabel="Retry sending uploaded media"
          >
            {{ isSending() ? 'Sending…' : 'Retry send' }}
          </app-button-primary>
          <app-button-secondary
            type="button"
            (clicked)="discardPending()"
            [disabled]="isSending()"
            customClass="min-h-11 px-3 text-xs"
            ariaLabel="Dismiss unsent uploaded media"
          >
            Dismiss
          </app-button-secondary>
        </div>
      </div>
    }
  `,
})
export class ChatMediaShareComponent {
  readonly roomId = input.required<string>();
  readonly open = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly pendingMedia = signal<UploadedChatMedia | null>(null);
  readonly isSending = signal(false);

  constructor(private readonly messages: ChatMediaMessageService) {}

  async onUploaded(media: UploadedChatMedia): Promise<void> {
    this.open.set(false);
    this.pendingMedia.set(media);
    await this.sendPending();
  }

  async retryPending(): Promise<void> {
    await this.sendPending();
  }

  discardPending(): void {
    if (this.isSending()) return;
    this.pendingMedia.set(null);
    this.sendError.set(null);
  }

  private async sendPending(): Promise<void> {
    const media = this.pendingMedia();
    if (!media || this.isSending()) return;

    this.isSending.set(true);
    this.sendError.set(null);
    try {
      await this.messages.send(this.roomId(), media);
      this.pendingMedia.set(null);
    } catch {
      // The backend send endpoint is idempotent for this uploaded object, so a
      // retry can safely reuse it without uploading the bytes a second time.
      this.sendError.set('Upload completed, but the message could not be sent.');
    } finally {
      this.isSending.set(false);
    }
  }
}
