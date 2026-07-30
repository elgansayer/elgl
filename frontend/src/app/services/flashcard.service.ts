import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateFlashcardDto {
  word: string;
  sourceLanguage: string;
  contextSentence: string;
  translation?: string;
}

@Injectable({ providedIn: 'root' })
export class FlashcardService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/flashcards`;

  async createFlashcard(dto: CreateFlashcardDto): Promise<unknown> {
    return firstValueFrom(
      this.http.post(this.baseUrl, dto)
    );
  }
}
