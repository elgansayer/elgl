import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  colour: string;
  icon: string;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDeckDto {
  name: string;
  description?: string;
  colour?: string;
  icon?: string;
}

export interface UpdateDeckDto {
  name?: string;
  description?: string;
  colour?: string;
  icon?: string;
}

@Injectable({ providedIn: 'root' })
export class DeckService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/decks`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  async getDecks(): Promise<Deck[]> {
    return firstValueFrom(
      this.http.get<Deck[]>(this.baseUrl, { headers: this.getHeaders() }),
    );
  }

  async getDeck(id: string): Promise<Deck | null> {
    return firstValueFrom(
      this.http.get<Deck>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() }),
    );
  }

  async createDeck(dto: CreateDeckDto): Promise<Deck> {
    return firstValueFrom(
      this.http.post<Deck>(this.baseUrl, dto, { headers: this.getHeaders() }),
    );
  }

  async updateDeck(id: string, dto: UpdateDeckDto): Promise<Deck> {
    return firstValueFrom(
      this.http.patch<Deck>(`${this.baseUrl}/${id}`, dto, { headers: this.getHeaders() }),
    );
  }

  async deleteDeck(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() }),
    );
  }

  async addFlashcardToDeck(deckId: string, flashcardId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/${deckId}/flashcards`,
        { flashcard_id: flashcardId },
        { headers: this.getHeaders() },
      ),
    );
  }

  async removeFlashcardFromDeck(deckId: string, flashcardId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${this.baseUrl}/${deckId}/flashcards/${flashcardId}`,
        { headers: this.getHeaders() },
      ),
    );
  }

  async getDeckFlashcards(deckId: string): Promise<string[]> {
    const response = await firstValueFrom(
      this.http.get<{ id: string }[]>(
        `${this.baseUrl}/${deckId}/flashcards`,
        { headers: this.getHeaders() },
      ),
    );
    return response.map((r) => r.id);
  }
}