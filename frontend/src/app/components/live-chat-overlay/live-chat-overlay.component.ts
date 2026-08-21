import {
  Component,
  ElementRef,
  DestroyRef,
  Injector,
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
            <span class="text-white/70 text-[10px] sm:text-xs font-semibold mb-0.5">{{
              msg.senderName
            }}</span>
            <span class="text-white text-xs sm:text-sm leading-snug break-words">{{
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
    `,
  ],
})
export class LiveChatOverlayComponent implements OnInit {
  roomId = input<string>('');

  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  centrifugo = inject(CentrifugoService);
  i18n = inject(I18nService);
  destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  messages = signal<LiveMessage[]>([]);
  channelName = '';
  subscription: unknown = null;

  // Integration with Centrifugo requires imperative setup; exception permitted per AGENTS.md 5.3
  ngOnInit() {
    const id = this.roomId();
    if (!id) return;

    this.channelName = `room_${id}`;

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
          id: event.id || crypto.randomUUID(),
          senderName: event.senderName || this.i18n.translate('common.user'),
          text: event.content,
          timestamp: Date.now(),
        });
      }
    });
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.channelName) {
        this.centrifugo.unsubscribe(this.channelName);
      }
    });
  }

  addMessage(msg: LiveMessage) {
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

  scrollToBottom() {
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
