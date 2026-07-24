import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  private readonly mockTags: HobbyTag[] = [
    { id: '1', name: 'Photography', category: 'Arts', icon: '📸', target_vocabulary: [], created_at: new Date().toISOString() },
    { id: '2', name: 'Gaming', category: 'Entertainment', icon: '🎮', target_vocabulary: [], created_at: new Date().toISOString() },
    { id: '3', name: 'Cooking', category: 'Lifestyle', icon: '🍳', target_vocabulary: [], created_at: new Date().toISOString() },
    { id: '4', name: 'Traveling', category: 'Lifestyle', icon: '✈️', target_vocabulary: [], created_at: new Date().toISOString() },
  ];
  private mockUserTags: UserHobbyTag[] = [];

  getAllTags(category?: string): Observable<HobbyTag[]> {
    const params: Record<string, string> = category ? { category } : {};
    return this.http.get<HobbyTag[]>(this.apiUrl, { params }).pipe(
      catchError(() => {
        if (category) {
          return of(this.mockTags.filter((t) => t.category === category));
        }
        return of(this.mockTags);
      })
    );
  }

  getMyTags(): Observable<UserHobbyTag[]> {
    return this.http.get<UserHobbyTag[]>(`${this.apiUrl}/my`).pipe(
      catchError(() => of([...this.mockUserTags]))
    );
  }

  addMyTag(hobbyTagId: string, proficiencyLevel?: number): Observable<UserHobbyTag> {
    return this.http.post<UserHobbyTag>(`${this.apiUrl}/my`, {
      hobby_tag_id: hobbyTagId,
      proficiency_level: proficiencyLevel,
    }).pipe(
      catchError(() => {
        const tag = this.mockTags.find(t => t.id === hobbyTagId);
        if (!tag) return of();
        const existing = this.mockUserTags.find(ut => ut.hobby_tag_id === hobbyTagId);
        if (existing) return of(existing);
        const newTag: UserHobbyTag = {
          id: `ut-${Date.now()}`,
          user_id: 'me',
          hobby_tag_id: hobbyTagId,
          proficiency_level: proficiencyLevel || 0,
          created_at: new Date().toISOString(),
          hobby_tag: tag
        };
        this.mockUserTags.push(newTag);
        return of(newTag);
      })
    );
  }

  removeMyTag(hobbyTagId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/my/${hobbyTagId}`).pipe(
      catchError(() => {
        this.mockUserTags = this.mockUserTags.filter((t) => t.hobby_tag_id !== hobbyTagId);
        return of({ success: true });
      })
    );
  }

  updateProficiency(hobbyTagId: string, level: number): Observable<UserHobbyTag> {
    return this.http.patch<UserHobbyTag>(`${this.apiUrl}/my/${hobbyTagId}/proficiency`, {
      proficiency_level: level,
    }).pipe(
      catchError(() => {
        const tag = this.mockUserTags.find((t) => t.hobby_tag_id === hobbyTagId);
        if (tag) {
          tag.proficiency_level = level;
          return of(tag);
        }
        return of();
      })
    );
  }

  getVocabulary(language: string): Observable<VocabularyItem[]> {
    return this.http.get<VocabularyItem[]>(`${this.apiUrl}/vocabulary`, {
      params: { language },
    }).pipe(
      catchError(() => of([]))
    );
  }
}
