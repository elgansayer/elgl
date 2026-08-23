import { Component, input, signal } from '@angular/core';
import { UploadedChatMedia } from '../../services/chat-media.service';
import { ChatMediaMessageService } from '../../services/chat-media-message.service';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { ChatMediaPickerComponent } from '../chat-media-picker/chat-media-picker.component';

@Component({
  selector: 'app-chat-media-share',
  imports: [AppButtonSecondaryComponent, ChatMediaPickerComponent],
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

    @if (sendError()) {
      <p role="alert" class="mt-1 text-xs text-danger">{{ sendError() }}</p>
    }
  `,
})
export class ChatMediaShareComponent {
  readonly roomId = input.required<string>();
  readonly open = signal(false);
  readonly sendError = signal<string | null>(null);

  constructor(private readonly messages: ChatMediaMessageService) {}

  async onUploaded(media: UploadedChatMedia): Promise<void> {
    this.sendError.set(null);
    try {
      await this.messages.send(this.roomId(), media);
      this.open.set(false);
    } catch {
      // The upload already succeeded, so keep the picker open and make the
      // send failure explicit instead of pretending the media message exists.
      this.sendError.set('Upload completed, but the message could not be sent. Please try again.');
    }
  }
}
