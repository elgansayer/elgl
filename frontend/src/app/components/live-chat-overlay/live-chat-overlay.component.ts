import {
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CentrifugoService, RoomLiveMessage } from '../../services/centrifugo.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface LiveMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

const MAX_MESSAGES = 50;

@Component({
  selector: 'app-live-chat-overlay',
  imports: [TranslatePipe],
  template: `
    <!-- Overlay container positioned at the bottom of the video stream -->
    <div
      class="absolute bottom-0 start-0 w-full h-72 p-4 flex flex-col justify-end pointer-events-none bg-gradient-to-t from-black/80 via-black/30 to-transparent z-50"
    >
      <!-- Scrollable message list with top-fade mask -->
      <div
        #scrollContainer
        class="overflow-y-auto flex flex-col gap-3 max-h-full pointer-events-auto scrollbar-hide mask-image-fade-top pb-2"
      >
        @for (msg of messages(); track msg.id) {
          <div
            class="flex flex-col bg-black/40 rounded-xl p-2.5 max-w-[85%] backdrop-blur-md animate-fade-in border border-white/10 shadow-sm"
          >
            <span class="text-white/70 text-xs font-semibold mb-0.5">
              @if (msg.senderName) {
                {{ msg.senderName }}
              } @else {
                {{ 'common.unknownUser' | t }}
              }
            </span>
            <span class="text-white text-sm leading-snug break-words">{{ msg.text }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Hide scrollbar for clean overlay look */
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      /* Fade out messages at the top of the container */
      .mask-image-fade-top {
        mask-image: linear-gradient(to bottom, transparent, black 25%);
        -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%);
      }

      /* Smooth entry animation for new comments */
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
export class LiveChatOverlayComponent implements OnInit, OnDestroy {
  roomId = input<string>('');

  private centrifugo = inject(CentrifugoService);
  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  messages = signal<LiveMessage[]>([]);

  // Imperative Centrifugo WebSocket subscription -- exception permitted per AGENTS.md 5.3
  ngOnInit(): void {
    const currentRoomId = this.roomId();
    if (!currentRoomId) return;

    this.centrifugo.subscribeLiveRoom(currentRoomId, (data: RoomLiveMessage) => {
      const content = data.content;
      if (data.type !== 'text' || !content) return;

      this.messages.update((prev) => {
        const next: LiveMessage[] = [
          ...prev,
          {
            id: data.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            senderName: data.sender_id ?? '',
            text: content,
            timestamp: Date.now(),
          },
        ];
        if (next.length > MAX_MESSAGES) {
          next.splice(0, next.length - MAX_MESSAGES);
        }
        return next;
      });

      // requestAnimationFrame avoids banned setTimeout while respecting the render cycle
      requestAnimationFrame(() => {
        const el = this.scrollContainer()?.nativeElement;
        if (el) {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      });
    });
  }

  // Imperative Centrifugo cleanup -- exception permitted per AGENTS.md 5.3
  ngOnDestroy(): void {
    this.centrifugo.unsubscribeLiveRoom(this.roomId());
  }
}
