import { HlmButton } from '@spartan-ng/helm/button';
import { Component, OnDestroy, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatMessage, FavouriteRecord } from '../../services/chat.service';
import { ConfirmService } from '../../services/confirm.service';
import { FavouriteService } from '../../services/favourite.service';
import { I18nService } from '../../services/i18n.service';
import { showToast } from '../../services/toast.service';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';

type FavouritesTab = 'all' | 'messages' | 'corrections' | 'audio' | 'moments';

interface TabDefinition {
  id: FavouritesTab;
  labelKey: string;
  icon: string;
}

const STARRED_PAGE_SIZE = 100;
const MAX_STARRED_MESSAGES = 500;

/**
 * Chat-room bookmarks saved before the note was removed carried an auto-generated English note that
 * embedded the private room identifier. It was never written by the user, so it is not shown.
 */
const LEGACY_AUTO_NOTE = /^Saved from room [0-9a-f-]{36}$/i;

/** Decorative stand-in shown instead of an initial when the sender has no display name. */
const ANONYMOUS_SENDER_GLYPH = '\u{1F464}';

@Component({
  selector: 'app-favourites',
  imports: [
    HlmButton,
    CommonModule,
    VisualDiffComponent,
    TranslatePipe,
    AppCardComponent,
    AppChipComponent,
  ],
  templateUrl: './favourites.component.html',
  styleUrls: ['./favourites.component.scss'],
})
export class FavouritesComponent implements OnDestroy {
  private favouriteService = inject(FavouriteService);
  private readonly confirmService = inject(ConfirmService);
  private readonly i18n = inject(I18nService);
  private readonly graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  readonly favourites = signal<FavouriteRecord[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<boolean>(false);
  /** True when the server reported more favourites than this screen is willing to load. */
  readonly isTruncated = signal<boolean>(false);
  readonly activeTab = signal<FavouritesTab>('all');
  readonly audioPlayingId = signal<string | null>(null);
  /** The favourite whose audio last failed to play, so the message appears on that row only. */
  readonly audioFailedId = signal<string | null>(null);
  readonly pendingDeleteIds = signal<ReadonlySet<string>>(new Set<string>());
  /** Favourites whose last removal attempt failed, so the failure appears on the affected row. */
  readonly deleteFailedIds = signal<ReadonlySet<string>>(new Set<string>());
  private audioElement: HTMLAudioElement | null = null;
  private loadGeneration = 0;

  readonly tabs: TabDefinition[] = [
    { id: 'all', labelKey: 'favourites.tabAll', icon: '\u2B50' },
    { id: 'messages', labelKey: 'favourites.tabMessages', icon: '\uD83D\uDCAC' },
    { id: 'corrections', labelKey: 'favourites.tabCorrections', icon: '\u270F\uFE0F' },
    { id: 'audio', labelKey: 'favourites.tabAudio', icon: '\uD83C\uDFA4' },
    { id: 'moments', labelKey: 'favourites.tabMoments', icon: '\uD83D\uDCF0' },
  ];

  readonly filteredFavourites = computed<FavouriteRecord[]>(() => {
    const all = this.favourites();
    const tab = this.activeTab();
    if (tab === 'all') return all;
    if (tab === 'messages') {
      return all.filter(
        (f) => f.item_type === 'message' && f.item_payload?.message_type === 'text',
      );
    }
    if (tab === 'corrections') {
      return all.filter(
        (f) => f.item_payload?.message_type === 'correction' || f.item_type === 'correction',
      );
    }
    if (tab === 'audio') {
      return all.filter((f) => f.item_type === 'audio' || f.item_payload?.message_type === 'voice');
    }
    if (tab === 'moments') {
      return all.filter((f) => f.item_type === 'moment');
    }
    return all;
  });

  readonly emptyStateKey = computed<string>(() => {
    const tab = this.activeTab();
    switch (tab) {
      case 'messages':
        return 'favourites.noMessages';
      case 'corrections':
        return 'favourites.noCorrections';
      case 'audio':
        return 'favourites.noAudio';
      case 'moments':
        return 'favourites.noMoments';
      default:
        return 'favourites.empty';
    }
  });

  constructor() {
    void this.loadFavourites();
  }

  ngOnDestroy(): void {
    this.loadGeneration++;
    this.stopAudio();
  }

  async loadFavourites(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.isLoading.set(true);
    this.loadError.set(false);

    try {
      const starred: FavouriteRecord[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && offset < MAX_STARRED_MESSAGES) {
        const limit = Math.min(
          STARRED_PAGE_SIZE,
          MAX_STARRED_MESSAGES - offset,
        );
        const page = await this.favouriteService.getStarredMessages(limit, offset);
        if (generation !== this.loadGeneration) return;

        starred.push(...page.items);
        hasMore = page.has_more;

        if (!hasMore || page.next_offset === null) break;
        if (page.next_offset <= offset) {
          throw new Error('Invalid starred messages pagination');
        }
        offset = page.next_offset;
      }

      if (generation !== this.loadGeneration) return;
      this.favourites.set(starred.slice(0, MAX_STARRED_MESSAGES));
      // The loop only stops with more pages available when it reached the inspection ceiling.
      this.isTruncated.set(hasMore);
    } catch {
      if (generation !== this.loadGeneration) return;
      this.loadError.set(true);
    } finally {
      if (generation === this.loadGeneration) {
        this.isLoading.set(false);
      }
    }
  }

  setTab(tab: FavouritesTab): void {
    this.activeTab.set(tab);
  }

  isDeletingFavourite(id: string): boolean {
    return this.pendingDeleteIds().has(id);
  }

  async deleteFavourite(fav: FavouriteRecord): Promise<void> {
    if (this.isDeletingFavourite(fav.id)) return;

    // Reserve the row before asking for confirmation so a repeated activation cannot open a second
    // dialog or send a second request while the first is still in flight.
    this.updateIdSet(this.pendingDeleteIds, fav.id, true);
    this.updateIdSet(this.deleteFailedIds, fav.id, false);

    try {
      const confirmed = await this.confirmService.confirm(
        this.i18n.translate('favourites.deleteConfirm'),
      );
      if (!confirmed) return;

      await this.favouriteService.removeFavourite(fav.id);
      if (this.audioPlayingId() === fav.id) {
        this.stopAudio();
      }
      this.favourites.update((list) => list.filter((f) => f.id !== fav.id));
      showToast(this.i18n.translate('favourites.deleted'), 'success');
    } catch {
      // The favourite stays in the list so the user can retry.
      this.updateIdSet(this.deleteFailedIds, fav.id, true);
    } finally {
      this.updateIdSet(this.pendingDeleteIds, fav.id, false);
    }
  }

  private updateIdSet(target: WritableSignal<ReadonlySet<string>>, id: string, present: boolean): void {
    target.update((ids) => {
      const next = new Set(ids);
      if (present) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  toggleAudio(fav: FavouriteRecord): void {
    const url = fav.item_payload?.media_url;
    if (!url) return;

    if (this.audioPlayingId() === fav.id) {
      this.stopAudio();
      return;
    }

    this.stopAudio();
    this.audioFailedId.set(null);
    const audio = new Audio(url);
    this.audioElement = audio;
    audio.onended = () => {
      if (this.audioElement !== audio) return;
      this.audioPlayingId.set(null);
      this.audioElement = null;
    };
    void audio
      .play()
      .then(() => {
        if (this.audioElement === audio) {
          this.audioPlayingId.set(fav.id);
        }
      })
      .catch(() => {
        if (this.audioElement === audio) {
          this.audioElement = null;
          this.audioPlayingId.set(null);
          this.audioFailedId.set(fav.id);
        }
      });
  }

  private stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
    this.audioPlayingId.set(null);
  }

  private isChatMessage(payload: unknown): payload is ChatMessage {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'id' in payload &&
      'room_id' in payload &&
      'sender_id' in payload &&
      'created_at' in payload
    );
  }

  /** The sender's public display name, or the translated generic label when none is available. */
  senderName(fav: FavouriteRecord): string {
    return (
      fav.item_payload?.sender?.display_name?.trim() ||
      this.i18n.translate('favourites.partnerFallback')
    );
  }

  /** First user-perceived character of the sender name, used when there is no avatar image. */
  senderInitial(fav: FavouriteRecord): string {
    const name = fav.item_payload?.sender?.display_name?.trim();
    if (!name) return ANONYMOUS_SENDER_GLYPH;
    const first = this.graphemeSegmenter.segment(name)[Symbol.iterator]().next();
    return first.done ? ANONYMOUS_SENDER_GLYPH : first.value.segment.toLocaleUpperCase();
  }

  /** The user's own note, excluding the auto-generated one older chat-room bookmarks carry. */
  visibleNote(fav: FavouriteRecord): string | null {
    const note = fav.notes?.trim();
    return note && !LEGACY_AUTO_NOTE.test(note) ? note : null;
  }

  getPayloadMessage(fav: FavouriteRecord): ChatMessage | null {
    const payload = fav.item_payload;
    if (this.isChatMessage(payload)) {
      return payload;
    }
    return null;
  }
}
