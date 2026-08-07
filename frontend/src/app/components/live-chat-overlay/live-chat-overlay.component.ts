import {
  Component,
  ElementRef,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
  OnInit,
} from '@angular/core';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface LiveMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface CentrifugoMessageData {
  type?: string;
  id?: string;
  senderName?: string;
  content: string;
}

@Component({
  selector: 'app-live-chat-overlay',
  imports: [TranslatePipe],
  templateUrl: './live-chat-overlay.component.html',
  styleUrl: './live-chat-overlay.component.scss',
})
export class LiveChatOverlayComponent implements OnInit {
  roomId = input.required<string>();

  private centrifugo = inject(CentrifugoService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  messages = signal<LiveMessage[]>([]);
  private channelName = '';
  private subscription: unknown = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.channelName) {
        this.centrifugo.unsubscribe(this.channelName);
      }
    });
  }

  // Integration with Centrifugo requires imperative setup; exception permitted per AGENTS.md 5.3
  ngOnInit() {
    this.channelName = `room_${this.roomId()}`;

    // Subscribe directly to the channel and listen for publications
    this.subscription = this.centrifugo.subscribe(this.channelName, (data: unknown) => {
      // Type guard to verify the payload shape
      const isCentrifugoMessageData = (value: unknown): value is CentrifugoMessageData => {
        if (typeof value !== 'object' || value === null) return false;
        if (!('type' in value) || !('content' in value)) return false;
        const type = value.type;
        const content = value.content;
        return typeof type === 'string' && typeof content === 'string';
      };

      if (!isCentrifugoMessageData(data)) return;

      const event = data;

      if (event.type === 'text') {
        this.addMessage({
          id: event.id || Math.random().toString(36).substring(2),
          senderName: event.senderName || this.i18n.translate('common.user'),
          text: event.content,
          timestamp: Date.now(),
        });
      }
    });
  }

  private addMessage(msg: LiveMessage) {
    this.messages.update((msgs) => {
      const newMsgs = [...msgs, msg];
      // Cap at 50 messages to maintain 60 FPS rendering performance
      if (newMsgs.length > 50) {
        newMsgs.shift();
      }
      return newMsgs;
    });
    this.scrollToBottom();
  }

  private scrollToBottom() {
    afterNextRender(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: 'smooth',
        });
      }
    });
  }
}
