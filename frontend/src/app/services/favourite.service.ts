import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { FavouriteRecord } from './chat.service';

export interface AddFavouriteDto {
  message_id: string;
  note_text?: string;
}

export interface FavouriteMutationResponse {
  success: boolean;
}

export interface StarredMessagesPage {
  items: FavouriteRecord[];
  has_more: boolean;
  next_offset: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class FavouriteService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/favourites`;

  addFavourite(dto: AddFavouriteDto): Promise<FavouriteMutationResponse> {
    return firstValueFrom(
      this.http.post<FavouriteMutationResponse>(this.baseUrl, dto),
    );
  }

  removeFavourite(favouriteId: string): Promise<FavouriteMutationResponse> {
    return firstValueFrom(
      this.http.delete<FavouriteMutationResponse>(
        `${this.baseUrl}/${encodeURIComponent(favouriteId)}`,
      ),
    );
  }

  getFavourites(): Promise<FavouriteRecord[]> {
    return firstValueFrom(this.http.get<FavouriteRecord[]>(this.baseUrl));
  }

  async getStarredMessages(limit = 50, offset = 0): Promise<StarredMessagesPage> {
    const params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset));
    const response = await firstValueFrom(
      this.http.get<StarredMessagesPage>(`${this.baseUrl}/messages`, { params }),
    );

    if (
      !response ||
      !Array.isArray(response.items) ||
      response.items.length > limit ||
      typeof response.has_more !== 'boolean' ||
      (response.has_more
        ? response.next_offset !== offset + limit
        : response.next_offset !== null)
    ) {
      throw new Error('Invalid starred messages response');
    }

    return response;
  }
}
