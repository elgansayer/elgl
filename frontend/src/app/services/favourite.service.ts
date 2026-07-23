import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AddFavouriteDto {
  message_id: string;
  note_text?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FavouriteService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  addFavourite(dto: AddFavouriteDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/favourites`, dto);
  }

  removeFavourite(favouriteId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/favourites/${favouriteId}`);
  }

  getFavourites(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/favourites/user/${userId}`);
  }
}
