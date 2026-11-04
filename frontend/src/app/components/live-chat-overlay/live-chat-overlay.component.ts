import {
  Component,
  ElementRef,
  DestroyRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
  OnInit,
} from '@angular/core';
import { CentrifugeService } from '../../services/centrifuge.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

export interface LiveMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseIncomingLiveMessage(data: unknown, fallbackUserName: string): LiveMessage | null {
  if (!isRecord(data)) {
    return null;
  }

  const type = typeof data['type'] === 'string' ? data['type'] : '';

  // Centrifugo room messages are broadcast as either 'chat_message' or 'text'
  if (type !== 'text' && type !== 'chat_message') {
    return null;
  }

  const innerMessage = isRecord(data['message']) ? data['message'] : null;

  // Extract message body from nested message payload or root payload
  const rawText =
    (innerMessage && typeof innerMessage['text_content'] === 'string' && innerMessage['text_content']) ||
    (innerMessage && typeof innerMessage['content'] === 'string' && innerMessage['content']) ||
    (innerMessage && typeof innerMessage['text'] === 'string' && innerMessage['text']) ||
    (typeof data['content'] === 'string' && data['content']) ||
    (typeof data['text'] === 'string' && data['text']) ||
    '';

  const text = rawText.trim();
  if (!text) {
    return null;
  }

  // Extract sender name
  const rawSender =
    (innerMessage && typeof innerMessage['sender_name'] === 'string' && innerMessage['sender_name'].trim()) ||
    (innerMessage && typeof innerMessage['senderName'] === 'string' && innerMessage['senderName'].trim()) ||
    (typeof data['sender_name'] === 'string' && data['sender_name'].trim()) ||
    (typeof data['senderName'] === 'string' && data['senderName'].trim()) ||
    fallbackUserName;

  // Extract ID or generate a secure fallback UUID
  const rawId =
    (innerMessage && typeof innerMessage['id'] === 'string' && innerMessage['id'].trim()) ||
    (typeof data['id'] === 'string' && data['id'].trim()) ||
    crypto.randomUUID();

  // Extract timestamp
  let timestamp = Date.now();
  if (innerMessage && typeof innerMessage['created_at'] === 'string') {
    const parsedTime = Date.parse(innerMessage['created_at']);
    if (!Number.isNaN(parsedTime)) {
      timestamp = parsedTime;
    }
  }

  return {
    id: rawId,
    senderName: rawSender,
    text,
    timestamp,
  };
}

@Component({
  selector: 'app-live-chat-overlay',
  imports: [TranslatePipe],
  template: `
    <!-- Overlay container positioned at the bottom of the video stream -->
    <div
      class="absolute bottom-0 start-0 w-full h-48 sm:h-60 md:h-72 p-3 sm:p-4 flex flex-col justify-end pointer-events-none bg-gradient-to-t from-black/80 via-black/30 to-transparent z-50"
      role="complementary"
      [attr.aria-label]="'liveChat.overlayAria' | t"
    >
      <!-- Scrollable message list with top-fade mask -->
      <div
        #scrollContainer
        class="overflow-y-auto flex flex-col gap-2 sm:gap-3 max-h-full pointer-events-auto scrollbar-hide mask-image-fade-top pb-2"
        role="log"
        aria-live="polite"
        [attr.aria-label]="'liveChat.overlayAria' | t"
      >
        @for (msg of messages(); track msg.id) {
          <div
            class="flex flex-col bg-black/40 rounded-xl p-2 sm:p-2.5 max-w-[90%] sm:max-w-[85%] backdrop-blur-md animate-fade-in border border-white/10 shadow-sm"
          >
            <span class="text-white/70 text-[10px] sm:text-xs font-semibold mb-0.5" dir="auto">{{
              msg.senderName
            }}</span>
            <span class="text-white text-xs sm:text-sm leading-snug break-words" dir="auto">{{
              msg.text
            }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .mask-image-fade-top {
        mask-image: linear-gradient(to bottom, transparent, black 25%);
        -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%);
      }
      @keyframes fadeInSlideUp {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .animate-fade-in {
        animation: fadeInSlideUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-fade-in {
          animation: none !important;
        }
      }
    `,
  ],
})
export class LiveChatOverlayComponent implements OnInit {
  readonly roomId = input<string>('');

  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  readonly centrifugo = inject(CentrifugeService);
  readonly i18n = inject(I18nService);
  readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly messages = signal<LiveMessage[]>([]);
  channelName = '';
  private releaseListener: (() => void) | null = null;

  constructor() {
    effect(() => {
      const id = this.roomId();
      if (!id) {
        this.teardownSubscription();
        return;
      }
      this.setupSubscription(id);
    });

    this.destroyRef.onDestroy(() => {
      this.teardownSubscription();
    });
  }

  // Integration with Centrifugo requires imperative setup; exception permitted per AGENTS.md
  ngOnInit(): void {
    const id = this.roomId();
    if (id) {
      this.setupSubscription(id);
    }
  }

  setupSubscription(id: string): void {
    const targetChannel = `room_${id}`;
    if (this.channelName === targetChannel && this.releaseListener) {
      return;
    }

    this.teardownSubscription();
    this.channelName = targetChannel;

    // Keep the store's primary room lifecycle and moderation-event handler intact.
    this.releaseListener = this.centrifugo.listen(this.channelName, (data: unknown) => {
      const fallbackUser = this.i18n.translate('common.user');
      const parsed = parseIncomingLiveMessage(data, fallbackUser);
      if (parsed) {
        this.addMessage(parsed);
      }
    });
  }

  teardownSubscription(): void {
    this.releaseListener?.();
    this.releaseListener = null;
    this.channelName = '';
  }

  addMessage(msg: LiveMessage): void {
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

  scrollToBottom(): void {
    afterNextRender(
      () => {
        const el = this.scrollContainer()?.nativeElement;
        if (el) {
          el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth',
          });
        }
      },
      { injector: this.injector },
    );
  }
}
