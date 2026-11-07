import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { AudioRoomsStore, RoomChatMessagePage } from '../../services/audio-rooms.store';
import { CentrifugeService } from '../../services/centrifuge.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { SoundboardComponent } from '../soundboard/soundboard.component';

const EMPTY_MESSAGE_PAGE: RoomChatMessagePage = {
  messages: [],
  limit: 50,
  offset: 0,
  has_more: false,
};

/** Distance in pixels from the newest message that still counts as "at the bottom". */
const LATEST_MESSAGE_TOLERANCE_PX = 24;

@Component({
  selector: 'app-room-chat',
  imports: [HlmInput, HlmButton, DatePipe, TranslatePipe, SoundboardComponent],
  template: `
    <section
      class="flex h-96 flex-col overflow-hidden rounded-3xl border border-surface-100 bg-surface-200 shadow-xl"
      [attr.aria-label]="'rooms.roomChat.title' | t"
    >
      <header
        class="flex items-center justify-between gap-2 border-b border-surface-100 bg-surface-300 px-4 py-3"
      >
        <h3 class="text-xs font-black text-text-primary">
          {{ 'rooms.roomChat.title' | t }}
        </h3>
        <button hlmBtn type="button" size="sm" variant="outline" (click)="toggleTab()">
          @if (activeTab() === 'subtitles') {
            {{ 'rooms.roomChat.showChatBtn' | t }}
          } @else {
            {{ 'rooms.roomChat.showSubtitlesBtn' | t: { count: store.captions().length } }}
          }
        </button>
      </header>

      @if (store.currentRoom(); as room) {
        <app-soundboard
          [roomId]="room.id"
          [hostUserId]="room.host_id"
          [coHostUserId]="room.co_host_id ?? ''"
        />
      }

      <div class="flex flex-1 flex-col gap-2 p-4 text-xs">
        @if (activeTab() === 'chat') {
          @if (!store.isConnectedToLiveKit()) {
            <p class="py-12 text-center text-text-muted" role="status">
              {{ 'rooms.roomChat.unavailable' | t }}
            </p>
          } @else if (historyResource.isLoading()) {
            <p class="py-12 text-center text-text-muted" role="status">
              {{ 'rooms.roomChat.loading' | t }}
            </p>
          } @else {
            @if (showLoadError()) {
              <div class="flex items-center justify-between gap-3" role="alert">
                <p class="text-danger-ink">{{ 'rooms.roomChat.loadError' | t }}</p>
                <button hlmBtn type="button" size="sm" variant="outline" (click)="retryHistory()">
                  {{ 'rooms.roomChat.retry' | t }}
                </button>
              </div>
            }
            <div
              #messageLog
              class="flex flex-1 flex-col gap-2 overflow-y-auto"
              role="log"
              aria-live="polite"
              [attr.aria-label]="'rooms.roomChat.messageListAria' | t"
              (scroll)="onLogScroll()"
            >
              @for (msg of messages(); track msg.id) {
                <article class="rounded-xl bg-surface-300 p-2">
                  <header
                    class="mb-0.5 flex items-center justify-between gap-2 text-[11px] font-bold text-text-secondary"
                  >
                    <span dir="auto">{{ msg.sender_name }}</span>
                    <time class="text-[9px] text-text-muted" [attr.datetime]="msg.created_at">
                      {{ msg.created_at | date: 'shortTime' }}
                    </time>
                  </header>
                  <p class="break-words text-text-primary" dir="auto">{{ msg.text_content }}</p>
                </article>
              } @empty {
                @if (!showLoadError()) {
                  <p class="py-12 text-center text-text-muted">
                    {{ 'rooms.roomChat.emptyChat' | t }}
                  </p>
                }
              }
            </div>
          }
        } @else {
          <div class="flex flex-1 flex-col gap-2 overflow-y-auto">
            @for (cap of store.captions(); track cap.id) {
              <article class="rounded-xl border border-secondary/30 bg-secondary/10 p-2.5">
                <h4 class="mb-1 text-[10px] font-bold text-secondary-ink" dir="auto">
                  {{ 'rooms.roomChat.speakerCaptionPrefix' | t: { name: cap.speaker_name } }}
                </h4>
                <p class="text-xs font-medium text-text-primary" dir="auto">
                  {{ cap.text_content }}
                </p>
              </article>
            } @empty {
              <p class="py-12 text-center text-text-muted">
                {{ 'rooms.roomChat.emptySubtitles' | t }}
              </p>
            }
          </div>
        }
      </div>

      @if (activeTab() === 'chat') {
        <div class="flex gap-2 border-t border-surface-100 bg-surface-300 p-3">
          <label class="sr-only" for="live-room-message">
            {{ 'rooms.roomChat.inputLabel' | t }}
          </label>
          <input
            #composer
            hlmInput
            id="live-room-message"
            type="text"
            maxlength="1000"
            [value]="inputText()"
            [disabled]="!store.isConnectedToLiveKit()"
            [readOnly]="isSending()"
            (input)="onMessageInput($event)"
            (keydown)="onComposerKeydown($event)"
            class="min-h-11 flex-1 rounded-xl border bg-surface-200 px-3 py-1.5 text-xs"
          />
          <button
            hlmBtn
            type="button"
            class="min-h-11"
            [disabled]="!canSend()"
            [attr.aria-busy]="isSending()"
            (click)="send()"
          >
            {{ 'rooms.roomChat.sendBtn' | t }}
          </button>
        </div>
        @if (sendError()) {
          <p class="bg-surface-300 px-3 pb-3 text-xs text-danger-ink" role="alert">
            {{ 'rooms.roomChat.sendError' | t }}
          </p>
        }
      }

      @if (activeTab() === 'subtitles' && store.isSpeaker()) {
        <div class="flex gap-2 border-t border-secondary/30 bg-secondary/10 p-3">
          <label class="sr-only" for="live-room-caption">
            {{ 'rooms.roomChat.captionLabel' | t }}
          </label>
          <input
            hlmInput
            id="live-room-caption"
            type="text"
            [value]="inputCaption()"
            (input)="onCaptionInput($event)"
            (keydown)="onCaptionKeydown($event)"
            class="min-h-11 flex-1 rounded-xl border bg-surface-200 px-3 py-1.5 text-xs"
          />
          <button hlmBtn type="button" size="sm" (click)="sendSubtitle()">
            {{ 'rooms.roomChat.broadcastBtn' | t }}
          </button>
          <button hlmBtn type="button" size="sm" (click)="broadcastAICaption()">
            {{ 'rooms.roomChat.broadcastAiBtn' | t }}
          </button>
        </div>
      }
    </section>
  `,
})
export class RoomChatComponent {
  readonly store = inject(AudioRoomsStore);
  readonly activeTab = signal<'chat' | 'subtitles'>('chat');
  readonly inputText = signal('');
  readonly inputCaption = signal('');
  readonly isSending = signal(false);
  readonly sendError = signal(false);

  private readonly pendingClientMessageId = signal<string | null>(null);
  private readonly pendingText = signal('');
  private readonly centrifuge = inject(CentrifugeService);
  private readonly realtimeInterrupted = signal(false);
  private readonly injector = inject(Injector);
  private readonly messageLog = viewChild<ElementRef<HTMLDivElement>>('messageLog');
  private readonly composer = viewChild<ElementRef<HTMLInputElement>>('composer');
  private readonly followsLatestMessage = signal(true);

  readonly historyResource = resource({
    params: () => {
      const room = this.store.currentRoom();
      return this.store.isConnectedToLiveKit() && room ? room.id : null;
    },
    loader: ({ params }) =>
      params ? this.store.getRoomChatMessages(params, 50, 0) : Promise.resolve(EMPTY_MESSAGE_PAGE),
    defaultValue: EMPTY_MESSAGE_PAGE,
  });

  readonly historyLoadError = computed(() => this.historyResource.error() !== undefined);
  readonly showLoadError = computed(
    () => this.historyLoadError() || this.store.roomChatRecoveryFailed(),
  );
  readonly messages = computed(() => {
    const history = this.historyLoadError() ? [] : this.historyResource.value().messages;
    const byId = new Map(
      [...history, ...this.store.roomMessages()].map((message) => [message.id, message]),
    );
    return [...byId.values()].sort((first, second) => {
      const timeOrder = first.created_at.localeCompare(second.created_at);
      return timeOrder === 0 ? first.id.localeCompare(second.id) : timeOrder;
    });
  });
  readonly canSend = computed(
    () =>
      this.store.isConnectedToLiveKit() && !this.isSending() && this.inputText().trim().length > 0,
  );

  constructor() {
    // Keep the newest message in view while the participant reads the tail of
    // the conversation. Scrolling away from the tail opts out until the
    // participant returns, so incoming messages never yank the reading
    // position. Tracking the log element also scrolls a freshly created log
    // (after the history loads or the participant returns from the subtitles
    // tab) to the newest message.
    effect(() => {
      const log = this.messageLog();
      const messageCount = this.messages().length;
      if (!log || messageCount === 0 || !this.followsLatestMessage()) return;
      afterNextRender(
        () => {
          log.nativeElement.scrollTop = log.nativeElement.scrollHeight;
        },
        { injector: this.injector },
      );
    });

    // Realtime delivery is not replayed after the connection drops. Once it
    // returns, re-read the newest persisted messages so nothing sent during the
    // gap is missing. Only a reconnect counts: the store already catches up
    // when the room subscription is first confirmed.
    effect(() => {
      const status = this.centrifuge.connectionStatus();
      untracked(() => {
        if (status === 'reconnecting') {
          this.realtimeInterrupted.set(true);
        } else if (status === 'connected' && this.realtimeInterrupted()) {
          this.realtimeInterrupted.set(false);
          void this.store.recoverRoomChatMessages();
        }
      });
    });
  }

  toggleTab(): void {
    this.activeTab.update((tab) => (tab === 'chat' ? 'subtitles' : 'chat'));
    // Reopening the conversation starts at the newest message.
    this.followsLatestMessage.set(true);
  }

  onLogScroll(): void {
    const element = this.messageLog()?.nativeElement;
    if (!element) return;
    const distanceFromLatest = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.followsLatestMessage.set(distanceFromLatest <= LATEST_MESSAGE_TOLERANCE_PX);
  }

  onMessageInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.inputText.set(target.value);
    if (target.value.trim() !== this.pendingText()) {
      this.pendingClientMessageId.set(null);
      this.pendingText.set('');
    }
    this.sendError.set(false);
  }

  onCaptionInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.inputCaption.set(target.value);
  }

  /**
   * Enter sends the draft, except while an input method editor is composing.
   * A CJK candidate confirmed with Enter must not send a half-finished
   * message.
   */
  onComposerKeydown(event: KeyboardEvent): void {
    if (event.isComposing || event.key !== 'Enter') return;
    event.preventDefault();
    void this.send();
  }

  onCaptionKeydown(event: KeyboardEvent): void {
    if (event.isComposing || event.key !== 'Enter') return;
    event.preventDefault();
    void this.sendSubtitle();
  }

  async send(): Promise<void> {
    const text = this.inputText().trim();
    if (!this.canSend() || !text) return;
    const clientMessageId = this.pendingClientMessageId() ?? crypto.randomUUID();
    this.pendingClientMessageId.set(clientMessageId);
    this.pendingText.set(text);
    this.isSending.set(true);
    this.sendError.set(false);
    try {
      await this.store.sendRoomChatMessage(text, clientMessageId);
      this.inputText.set('');
      this.pendingClientMessageId.set(null);
      this.pendingText.set('');
    } catch {
      this.sendError.set(true);
    } finally {
      this.isSending.set(false);
      this.restoreComposerFocus();
    }
  }

  /**
   * The composer stays focusable while a message is in flight (it is read-only
   * rather than disabled), but the Send button disables itself, which drops
   * focus for keyboard users who activated it. Returning focus to the composer
   * keeps the next message one keystroke away and, after a failure, leaves the
   * kept draft ready to retry.
   */
  private restoreComposerFocus(): void {
    afterNextRender(() => this.composer()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  retryHistory(): void {
    if (this.historyLoadError()) this.historyResource.reload();
    if (this.store.roomChatRecoveryFailed()) void this.store.recoverRoomChatMessages();
  }

  async sendSubtitle(): Promise<void> {
    const text = this.inputCaption().trim();
    if (!text) return;
    await this.store.sendCaption(text);
    this.inputCaption.set('');
  }

  async broadcastAICaption(): Promise<void> {
    const text = this.inputCaption().trim();
    if (!text) return;
    await this.store.broadcastAICaption(text);
    this.inputCaption.set('');
  }
}
