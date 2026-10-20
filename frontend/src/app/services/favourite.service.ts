import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({
  providedIn: 'root',
})
export class FavouriteService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/chat`;

  addFavourite(dto: AddFavouriteDto): Promise<FavouriteMutationResponse> {
    return firstValueFrom(
      this.http.post<FavouriteMutationResponse>(`${this.baseUrl}/favourites`, dto),
    );
  }

  removeFavourite(favouriteId: string): Promise<FavouriteMutationResponse> {
    return firstValueFrom(
      this.http.delete<FavouriteMutationResponse>(
        `${this.baseUrl}/favourites/${encodeURIComponent(favouriteId)}`,
      ),
    );
  }

  getFavourites(): Promise<FavouriteRecord[]> {
    return firstValueFrom(this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`));
  }
}
