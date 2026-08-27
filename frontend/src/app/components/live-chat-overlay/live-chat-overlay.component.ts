import { Component, computed, inject, input } from '@angular/core';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { I18nService } from '../../services/i18n.service';

const MAX_OVERLAY_MESSAGES = 30;
const MAX_MESSAGE_ID_LENGTH = 128;
const MAX_SENDER_NAME_LENGTH = 80;
const MAX_MESSAGE_TEXT_LENGTH = 500;

export interface LiveOverlayMessage {
  id: string;
  senderName: string;
  text: string;
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Array.from(trimmed).slice(0, maxLength).join('');
}

/**
 * Treat room-chat state as an untrusted realtime boundary before rendering it
 * over video. The canonical AudioRoomsStore owns the Centrifugo subscription;
 * this component only derives a small, bounded visual projection from it.
 */
export function buildLiveOverlayMessages(
  values: readonly unknown[],
  fallbackSenderName: string,
): LiveOverlayMessage[] {
  const fallbackSender =
    boundedText(fallbackSenderName, MAX_SENDER_NAME_LENGTH) ?? 'User';
  const result: LiveOverlayMessage[] = [];
  const seenIds = new Set<string>();

  for (let index = values.length - 1; index >= 0 && result.length < MAX_OVERLAY_MESSAGES; index--) {
    const value = values[index];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;

    const record = value as Record<string, unknown>;
    const id = boundedText(record['id'], MAX_MESSAGE_ID_LENGTH);
    const text = boundedText(record['text_content'], MAX_MESSAGE_TEXT_LENGTH);
    if (!id || !text || seenIds.has(id)) continue;

    const senderName = boundedText(record['sender_name'], MAX_SENDER_NAME_LENGTH) ?? fallbackSender;
    seenIds.add(id);
    result.push({ id, senderName, text });
  }

  return result.reverse();
}

@Component({
  selector: 'app-live-chat-overlay',
  template: `
    @if (messages().length > 0) {
      <div
        class="absolute inset-x-0 bottom-0 z-50 flex h-48 flex-col justify-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 pointer-events-none sm:h-60 sm:p-4 md:h-72"
        aria-hidden="true"
        data-testid="live-chat-overlay"
      >
        <div class="flex max-h-full flex-col justify-end gap-2 overflow-hidden pb-2 sm:gap-3">
          @for (msg of messages(); track msg.id) {
            <div
              class="live-comment max-w-[90%] rounded-card border border-white/10 bg-black/50 p-2 shadow-sm backdrop-blur-md sm:max-w-[85%] sm:p-2.5"
              dir="auto"
            >
              <span class="mb-0.5 block text-[10px] font-semibold text-white/70 sm:text-xs">{{
                msg.senderName
              }}</span>
              <span class="block break-words text-xs leading-snug text-white sm:text-sm">{{
                msg.text
              }}</span>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .live-comment {
        animation: liveCommentEnter 180ms ease-out both;
      }

      @keyframes liveCommentEnter {
        from {
          opacity: 0;
          transform: translateY(0.5rem);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .live-comment {
          animation: none;
        }
      }
    `,
  ],
})
export class LiveChatOverlayComponent {
  readonly roomId = input<string>('');

  private readonly store = inject(AudioRoomsStore);
  private readonly i18n = inject(I18nService);

  readonly messages = computed(() => {
    const requestedRoomId = this.roomId().trim();
    const activeRoomId = this.store.currentRoom()?.id;
    if (!requestedRoomId || requestedRoomId !== activeRoomId) return [];

    return buildLiveOverlayMessages(
      this.store.roomMessages(),
      this.i18n.translate('common.user'),
    );
  });
}
