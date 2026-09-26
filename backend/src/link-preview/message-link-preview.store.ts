import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { LinkPreview } from './interfaces/link-preview.interface';
import {
  canonicalLinkPreviewUrl,
  extractFirstHttpUrl,
} from './link-preview-url';
import { LinkPreviewService } from './link-preview.service';
import { MetricsService } from '../metrics/metrics.service';

/**
 * How long the preview shown with a message is kept after it was sent. The
 * preview is derived data: once it expires the message simply renders as text.
 */
export const MESSAGE_PREVIEW_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Upper bound on messages looked up at once; history pages are far smaller. */
const MAX_MESSAGES_PER_LOOKUP = 200;
const KEY_PREFIX = 'link_preview:message:v1';

/** The parts of a chat message that decide whether it can carry a preview. */
export interface PreviewableMessage {
  id: string;
  message_type: string;
  text_content?: string | null;
}

/**
 * The card a message showed when it was sent, kept so it is still there when
 * the conversation is reopened, on another device, or by another participant.
 *
 * Redis (with append-only persistence in the shipped compose stack) holds it
 * because the preview is regenerable enrichment, not message content: a lost
 * entry degrades to a plain text message and never blocks delivery. Entries are
 * bound to the message text, so an edit that changes the link stops the old
 * card from being shown.
 */
@Injectable()
export class MessageLinkPreviewStore {
  private readonly logger = new Logger(MessageLinkPreviewStore.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly linkPreviews: LinkPreviewService,
    private readonly metrics: MetricsService,
  ) {}

  /** Keeps the preview a message was sent with. Never throws. */
  async save(messageId: string, preview: LinkPreview): Promise<void> {
    try {
      await this.redis.set(
        this.key(messageId),
        JSON.stringify(preview),
        'EX',
        MESSAGE_PREVIEW_TTL_SECONDS,
      );
      this.metrics.recordLinkPreviewPersistence('save', 'ok');
    } catch {
      this.metrics.recordLinkPreviewPersistence('save', 'error');
      this.logger.warn('Message link-preview store write unavailable');
    }
  }

  /** Forgets a message's preview, for example when the message is deleted. Never throws. */
  async remove(messageId: string): Promise<void> {
    try {
      await this.redis.del(this.key(messageId));
      this.metrics.recordLinkPreviewPersistence('remove', 'ok');
    } catch {
      this.metrics.recordLinkPreviewPersistence('remove', 'error');
      this.logger.warn('Message link-preview store delete unavailable');
    }
  }

  /**
   * Finds the stored previews for a page of messages with one round trip.
   * Only previews that still match the message's current first link are
   * returned, and each one is re-validated because Redis content is untrusted.
   * Never throws: on any failure the messages simply have no card.
   */
  async load(
    messages: readonly PreviewableMessage[],
  ): Promise<Map<string, LinkPreview>> {
    const previews = new Map<string, LinkPreview>();
    const candidates = messages
      .flatMap((message) => {
        const url = this.firstLinkOf(message);
        return url ? [{ id: message.id, url }] : [];
      })
      .slice(0, MAX_MESSAGES_PER_LOOKUP);
    if (candidates.length === 0) {
      return previews;
    }

    try {
      const stored = await this.redis.mget(
        ...candidates.map((candidate) => this.key(candidate.id)),
      );
      let hits = 0;
      candidates.forEach((candidate, index) => {
        const raw = stored[index];
        const preview = raw
          ? this.linkPreviews.parseUntrustedPreview(raw, candidate.url)
          : null;
        if (preview) {
          previews.set(candidate.id, preview);
          hits += 1;
        }
      });
      this.metrics.recordLinkPreviewPersistence('load', 'hit', hits);
      this.metrics.recordLinkPreviewPersistence(
        'load',
        'miss',
        candidates.length - hits,
      );
    } catch {
      this.metrics.recordLinkPreviewPersistence('load', 'error');
      this.logger.warn('Message link-preview store read unavailable');
      previews.clear();
    }
    return previews;
  }

  /** The normalised first link of a text message, which the stored card must match. */
  private firstLinkOf(message: PreviewableMessage): string | null {
    if (message.message_type !== 'text' || !message.text_content) {
      return null;
    }
    const link = extractFirstHttpUrl(message.text_content);
    return link ? canonicalLinkPreviewUrl(link) : null;
  }

  private key(messageId: string): string {
    return `${KEY_PREFIX}:${messageId}`;
  }
}
