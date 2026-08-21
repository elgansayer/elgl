import { HlmButton } from '@spartan-ng/helm/button';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatService, FavouriteRecord, ChatMessage } from '../../services/chat.service';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';

type FavouritesTab = 'all' | 'messages' | 'corrections' | 'audio' | 'moments';

interface TabDefinition {
  id: FavouritesTab;
  labelKey: string;
  icon: string;
}

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
  private chatService = inject(ChatService);

  readonly favourites = signal<FavouriteRecord[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly activeTab = signal<FavouritesTab>('all');
  readonly audioPlayingId = signal<string | null>(null);
  readonly pendingDeleteIds = signal<ReadonlySet<string>>(new Set<string>());
  private audioElement: HTMLAudioElement | null = null;

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
    this.loadFavourites();
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  async loadFavourites(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.chatService.getFavourites();
      this.favourites.set(data);
    } catch (e) {
      console.error('Failed to load favourites:', e);
    } finally {
      this.isLoading.set(false);
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

    this.pendingDeleteIds.update((ids) => {
      const next = new Set(ids);
      next.add(fav.id);
      return next;
    });

    try {
      await this.chatService.removeFavourite(fav.id);
      if (this.audioPlayingId() === fav.id) {
        this.stopAudio();
      }
      this.favourites.update((list) => list.filter((f) => f.id !== fav.id));
    } catch (e) {
      console.error('Failed to delete favourite:', e);
    } finally {
      this.pendingDeleteIds.update((ids) => {
        const next = new Set(ids);
        next.delete(fav.id);
        return next;
      });
    }
  }

  toggleAudio(fav: FavouriteRecord): void {
    const url = fav.item_payload?.media_url;
    if (!url) return;

    if (this.audioPlayingId() === fav.id) {
      this.stopAudio();
      return;
    }

    this.stopAudio();
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

  getPayloadMessage(fav: FavouriteRecord): ChatMessage | null {
    const payload = fav.item_payload;
    if (this.isChatMessage(payload)) {
      return payload;
    }
    return null;
  }
}
