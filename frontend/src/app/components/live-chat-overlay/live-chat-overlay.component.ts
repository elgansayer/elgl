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
import { FormsModule } from '@angular/forms';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

interface LiveMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface CentrifugoMessageData {
  type?: string;
  id?: string;
  sender_id?: string;
  senderName?: string;
  content: string;
}

@Component({
  selector: 'app-live-chat-overlay',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './live-chat-overlay.component.html',
  styleUrl: './live-chat-overlay.component.scss',
})
export class LiveChatOverlayComponent implements OnInit {
  readonly roomId = input.required<string>();

  private readonly centrifugo = inject(CentrifugoService);
  private readonly i18n = inject(I18nService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  readonly messages = signal<LiveMessage[]>([]);
  readonly inputText = signal('');
  readonly isExpanded = signal<boolean>(false);

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

    this.subscription = this.centrifugo.subscribe(this.channelName, (data: unknown) => {
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
          senderId: event.sender_id || '',
          senderName: event.senderName || this.i18n.translate('common.user'),
          text: event.content,
          timestamp: Date.now(),
        });
      }
    });
  }

  toggle(): void {
    this.isExpanded.update((v) => !v);
  }

  sendMessage(): void {
    const content = this.inputText().trim();
    if (!content) return;

    const currentUser = this.authService.currentUser();
    const senderName = currentUser?.user_metadata?.['display_name'] ?? this.i18n.translate('common.user');

    this.centrifugo.publish(this.channelName, {
      type: 'text',
      content,
      senderName,
      sender_id: currentUser?.id ?? '',
      id: Math.random().toString(36).substring(2),
    });

    this.inputText.set('');
  }

  onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.inputText.set(target.value);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private addMessage(msg: LiveMessage) {
    this.messages.update((msgs) => {
      const newMsgs = [...msgs, msg];
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
