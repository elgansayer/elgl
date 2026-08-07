import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
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
    <div
      class="absolute bottom-0 start-0 w-full h-72 p-4 flex flex-col justify-end pointer-events-none bg-gradient-to-t from-black/80 via-black/30 to-transparent z-50"
    >
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
  styles: [`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .mask-image-fade-top {
      mask-image: linear-gradient(to bottom, transparent, black 25%);
      -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%);
    }
    @keyframes fadeInSlideUp {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-fade-in { animation: fadeInSlideUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  `],
})
export class LiveChatOverlayComponent {
  readonly roomId = input<string>('');

  private readonly centrifugo = inject(CentrifugoService);
  private readonly i18n = inject(I18nService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  readonly messages = signal<LiveMessage[]>([]);

  constructor() {
    // Integration with Centrifugo requires imperative setup; exception permitted per AGENTS.md 5.3
    effect((onCleanup) => {
      const channelName = `room_${this.roomId()}`;

      this.centrifugo.subscribe(channelName, (data: unknown) => {
        if (!this.isCentrifugoMessageData(data)) return;
        if (data.type === 'text') {
          this.addMessage({
            id: data.id || Math.random().toString(36).substring(2),
            senderName: data.senderName || this.i18n.translate('common.user'),
            text: data.content,
            timestamp: Date.now(),
          });
        }
      });

      onCleanup(() => {
        this.centrifugo.unsubscribe(channelName);
      });
    });
  }

  private isCentrifugoMessageData(value: unknown): value is CentrifugoMessageData {
    if (typeof value !== 'object' || value === null) return false;
    if (!('type' in value) || !('content' in value)) return false;
    const type = (value as Record<string, unknown>).type;
    const content = (value as Record<string, unknown>).content;
    return typeof type === 'string' && typeof content === 'string';
  }

  private addMessage(msg: LiveMessage): void {
    this.messages.update((msgs) => {
      const newMsgs = [...msgs, msg];
      if (newMsgs.length > 50) { newMsgs.shift(); }
      return newMsgs;
    });
    this.scheduleScrollToBottom();
  }

  private scheduleScrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }
    }, 0);
  }
}
