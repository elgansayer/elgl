import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HobbyTag {
  id: string;
  name: string;
  category: string;
  icon: string;
  target_vocabulary: Array<{ word: string; translation: string; language: string }>;
  created_at: string;
}

export interface UserHobbyTag {
  id: string;
  user_id: string;
  hobby_tag_id: string;
  proficiency_level: number;
  created_at: string;
  hobby_tag?: HobbyTag;
}

export interface VocabularyItem {
  word: string;
  translation: string;
  hobbyTagName: string;
}

@Injectable({
  providedIn: 'root',
})
export class HobbyTagsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/hobby-tags`;

  getAllTags(category?: string): Observable<HobbyTag[]> {
    const params: Record<string, string> = category ? { category } : {};
    return this.http.get<HobbyTag[]>(this.apiUrl, { params });
  }

  getMyTags(): Observable<UserHobbyTag[]> {
    return this.http.get<UserHobbyTag[]>(`${this.apiUrl}/my`);
  }

  addMyTag(hobbyTagId: string, proficiencyLevel?: number): Observable<UserHobbyTag> {
    return this.http.post<UserHobbyTag>(`${this.apiUrl}/my`, {
      hobby_tag_id: hobbyTagId,
      proficiency_level: proficiencyLevel,
    });
  }

  removeMyTag(hobbyTagId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/my/${hobbyTagId}`);
  }

  updateProficiency(hobbyTagId: string, level: number): Observable<UserHobbyTag> {
    return this.http.patch<UserHobbyTag>(`${this.apiUrl}/my/${hobbyTagId}/proficiency`, {
      proficiency_level: level,
    });
  }

  getVocabulary(language: string): Observable<VocabularyItem[]> {
    return this.http.get<VocabularyItem[]>(`${this.apiUrl}/vocabulary`, {
      params: { language },
    });
  }
}
