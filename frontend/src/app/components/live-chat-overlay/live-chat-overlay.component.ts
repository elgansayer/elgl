import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CentrifugoService } from '../../services/centrifugo.service';

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
  standalone: true,
  imports: [CommonModule],
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
            <span class="text-white/70 text-xs font-semibold mb-0.5">{{ msg.senderName }}</span>
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
  roomId = input.required<string>();

  private centrifugo = inject(CentrifugoService);
  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  messages = signal<LiveMessage[]>([]);
  private channelName = '';

  constructor() {
    // Listen to global Centrifugo events and filter for this room's chat
    effect(() => {
      const events = this.centrifugo.events();
      if (events.length === 0) return;

      const latestEvent = events[events.length - 1];

      if (latestEvent && latestEvent.channel === this.channelName) {
        const data = latestEvent.data as CentrifugoMessageData;

        // Handle text payloads as defined in SPEC.md
        if (data.type === 'text') {
          this.addMessage({
            id: data.id || Math.random().toString(36).substring(2),
            senderName: data.senderName || 'User',
            text: data.content,
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  ngOnInit() {
    // SPEC.md: Audio Room Chat Overlay uses channel `room_{audio_room_id}`
    this.channelName = `room_${this.roomId()}`;

    // Ensure we are subscribed to the room's chat channel
    // (Assuming the parent component might have already subscribed, but safe to call if idempotent)
    // this.centrifugo.subscribe(this.channelName);
  }

  private addMessage(msg: LiveMessage) {
    this.messages.update((msgs) => {
      const newMsgs = [...msgs, msg];
      // Cap at 50 messages to maintain 60 FPS rendering performance (SPEC.md requirement)
      if (newMsgs.length > 50) {
        newMsgs.shift();
      }
      return newMsgs;
    });
    this.scrollToBottom();
  }

  private scrollToBottom() {
    // Small delay to allow Angular to render the new DOM node before scrolling
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  }

  ngOnDestroy() {
    if (this.channelName) {
      this.centrifugo.unsubscribe(this.channelName);
    }
  }
}
