import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
  id: string;
  word: string;
  translation: string;
  hobbyTagName: string;
  difficulty: string;
  context_sentence?: string;
  hobby_tag?: { icon: string; name: string };
}

@Injectable({
  providedIn: 'root',
})
export class HobbyTagsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/hobby-tags`;

  getAllTags(category?: string): Promise<HobbyTag[]> {
    const params: Record<string, string> = category ? { category } : {};
    return firstValueFrom(this.http.get<HobbyTag[]>(this.apiUrl, { params }));
  }

  createGlobalTag(name: string, category: string, icon: string = '✨'): Promise<HobbyTag> {
    return firstValueFrom(this.http.post<HobbyTag>(this.apiUrl, { name, category, icon }));
  }

  getMyTags(): Promise<UserHobbyTag[]> {
    return firstValueFrom(this.http.get<UserHobbyTag[]>(`${this.apiUrl}/my`));
  }

  addMyTag(hobbyTagId: string, proficiencyLevel?: number): Promise<UserHobbyTag> {
    return firstValueFrom(
      this.http.post<UserHobbyTag>(`${this.apiUrl}/my`, {
        hobby_tag_id: hobbyTagId,
        proficiency_level: proficiencyLevel,
      }),
    );
  }

  removeMyTag(hobbyTagId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/my/${hobbyTagId}`),
    );
  }

  updateProficiency(hobbyTagId: string, level: number): Promise<UserHobbyTag> {
    return firstValueFrom(
      this.http.patch<UserHobbyTag>(`${this.apiUrl}/my/${hobbyTagId}`, {
        proficiency_level: level,
      }),
    );
  }

  getVocabulary(language: string): Promise<VocabularyItem[]> {
    return firstValueFrom(
      this.http.get<Array<VocabularyItem>>(`${this.apiUrl}/vocabulary`, {
        params: { language },
      }),
    );
  }
}
