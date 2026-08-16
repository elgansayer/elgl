import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { FavouriteRecord } from './chat.service';
import { ChatCacheService } from './chat-cache.service';

export interface AddFavouriteDto {
  message_id: string;
  note_text?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavouriteService {
  private http = inject(HttpClient);
  private cache = inject(ChatCacheService);
  private baseUrl = `${environment.apiUrl}/chat`;

  async addFavourite(dto: AddFavouriteDto): Promise<unknown> {
    const result = await firstValueFrom(this.http.post(`${this.baseUrl}/favourites`, dto));
    await this.refreshCacheBestEffort();
    return result;
  }

  async removeFavourite(favouriteId: string): Promise<unknown> {
    const result = await firstValueFrom(
      this.http.delete(`${this.baseUrl}/favourites/${favouriteId}`),
    );
    await this.refreshCacheBestEffort();
    return result;
  }

  async getFavourites(): Promise<FavouriteRecord[]> {
    const cached = await this.cache.getCachedFavourites().catch(() => null);
    if (cached) return cached;
    return this.fetchAndCacheFavourites();
  }

  async isMessageFavourite(messageId: string): Promise<boolean> {
    const favourites = await this.getFavourites();
    return favourites.some(
      (favourite) =>
        favourite.item_type === 'message' && favourite.item_payload?.id === messageId,
    );
  }

  async toggleMessageFavourite(messageId: string): Promise<boolean> {
    const favourites = await this.getFavourites();
    const existing = favourites.find(
      (favourite) =>
        favourite.item_type === 'message' && favourite.item_payload?.id === messageId,
    );

    if (existing) {
      await this.removeFavourite(existing.id);
      return false;
    }

    await this.addFavourite({ message_id: messageId });
    return true;
  }

  private async fetchAndCacheFavourites(): Promise<FavouriteRecord[]> {
    const favourites = await firstValueFrom(
      this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`),
    );
    await this.cache.cacheFavourites(favourites).catch(() => undefined);
    return favourites;
  }

  private async refreshCacheBestEffort(): Promise<void> {
    try {
      const favourites = await firstValueFrom(
        this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`),
      );
      await this.cache.cacheFavourites(favourites).catch(() => undefined);
    } catch {
      await this.cache.invalidateFavourites().catch(() => undefined);
    }
  }
}
