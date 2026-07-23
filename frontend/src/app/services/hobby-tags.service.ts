import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface HobbyTag {
  id: string;
  name: string;
  category: string;
  icon: string;
  created_at: string;
}

export interface UserHobbyTag {
  id: string;
  user_id: string;
  hobby_tag_id: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'native';
  hobby_tag: HobbyTag;
  created_at: string;
}

export interface HobbyVocabulary {
  id: string;
  hobby_tag_id: string;
  word: string;
  translation: string;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context_sentence: string | null;
  hobby_tag?: { name: string; icon: string };
}

@Injectable({
  providedIn: 'root',
})
export class HobbyTagsService {
  private apiUrl = `${environment.apiUrl}/hobby-tags`;

  readonly allTags = signal<HobbyTag[]>([]);
  readonly userTags = signal<UserHobbyTag[]>([]);
  readonly userVocabulary = signal<HobbyVocabulary[]>([]);
  readonly loading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  fetchAllTags(): void {
    this.loading.set(true);
    this.http.get<HobbyTag[]>(this.apiUrl).subscribe({
      next: (tags) => {
        this.allTags.set(tags);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  fetchUserTags(): void {
    this.loading.set(true);
    this.http.get<UserHobbyTag[]>(`${this.apiUrl}/my`).subscribe({
      next: (tags) => {
        this.userTags.set(tags);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addTag(hobbyTagId: string, proficiencyLevel?: string): void {
    this.http
      .post<UserHobbyTag>(`${this.apiUrl}/my`, {
        hobby_tag_id: hobbyTagId,
        proficiency_level: proficiencyLevel,
      })
      .subscribe({
        next: (newTag) => {
          this.userTags.update((tags) => [...tags, newTag]);
        },
      });
  }

  removeTag(hobbyTagId: string): void {
    this.http.delete(`${this.apiUrl}/my/${hobbyTagId}`).subscribe({
      next: () => {
        this.userTags.update((tags) =>
          tags.filter((t) => t.hobby_tag_id !== hobbyTagId)
        );
      },
    });
  }

  updateProficiency(hobbyTagId: string, level: string): void {
    this.http
      .patch<UserHobbyTag>(`${this.apiUrl}/my/${hobbyTagId}`, {
        proficiency_level: level,
      })
      .subscribe({
        next: (updated) => {
          this.userTags.update((tags) =>
            tags.map((t) =>
              t.hobby_tag_id === hobbyTagId ? updated : t
            )
          );
        },
      });
  }

  fetchUserVocabulary(): void {
    this.http
      .get<HobbyVocabulary[]>(`${this.apiUrl}/my/vocabulary`)
      .subscribe({
        next: (vocab) => this.userVocabulary.set(vocab),
      });
  }

  getVocabularyForHobby(hobbyTagId: string, language?: string): void {
    this.http
      .get<HobbyVocabulary[]>(`${this.apiUrl}/${hobbyTagId}/vocabulary`, {
        params: language ? { language } : {},
      })
      .subscribe({
        next: (vocab) => this.userVocabulary.set(vocab),
      });
  }
}
