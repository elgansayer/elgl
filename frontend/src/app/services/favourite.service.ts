import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { FavouriteRecord } from './chat.service';

export interface AddFavouriteDto {
  message_id: string;
  note_text?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavouriteService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/chat`;

  addFavourite(dto: AddFavouriteDto): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/favourites`, dto));
  }

  removeFavourite(favouriteId: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/favourites/${favouriteId}`));
  }

  getFavourites(): Promise<FavouriteRecord[]> {
    return firstValueFrom(this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`));
  }
}
