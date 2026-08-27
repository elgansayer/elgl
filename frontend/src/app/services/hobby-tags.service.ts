import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, catchError } from 'rxjs';
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

  private readonly mockTags: HobbyTag[] = [
    {
      id: '1',
      name: 'Photography',
      category: 'Arts',
      icon: '📸',
      target_vocabulary: [
        { word: 'camera', translation: 'cámara', language: 'es' },
        { word: 'lens', translation: 'lente', language: 'es' },
        { word: 'camera', translation: 'appareil photo', language: 'fr' },
        { word: 'lens', translation: 'objectif', language: 'fr' },
        { word: 'camera', translation: 'カメラ', language: 'ja' },
        { word: 'lens', translation: 'レンズ', language: 'ja' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Gaming',
      category: 'Entertainment',
      icon: '🎮',
      target_vocabulary: [
        { word: 'console', translation: 'consola', language: 'es' },
        { word: 'controller', translation: 'control', language: 'es' },
        { word: 'console', translation: 'console', language: 'fr' },
        { word: 'controller', translation: 'manette', language: 'fr' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Cooking',
      category: 'Lifestyle',
      icon: '🍳',
      target_vocabulary: [
        { word: 'recipe', translation: 'receta', language: 'es' },
        { word: 'ingredient', translation: 'ingrediente', language: 'es' },
        { word: 'recipe', translation: 'recette', language: 'fr' },
        { word: 'ingredient', translation: 'ingrédient', language: 'fr' },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Travelling',
      category: 'Lifestyle',
      icon: '✈️',
      target_vocabulary: [
        { word: 'itinerary', translation: 'itinerario', language: 'es' },
        { word: 'destination', translation: 'destino', language: 'es' },
        { word: 'itinerary', translation: 'itinéraire', language: 'fr' },
        { word: 'destination', translation: 'destination', language: 'fr' },
      ],
      created_at: new Date().toISOString(),
    },
  ];
  private mockUserTags: UserHobbyTag[] = [];

  getAllTags(category?: string): Promise<HobbyTag[]> {
    const params: Record<string, string> = category ? { category } : {};
    return firstValueFrom(
      this.http.get<HobbyTag[]>(this.apiUrl, { params }).pipe(
        catchError(() => {
          if (category) {
            return of(this.mockTags.filter((t) => t.category === category));
          }
          return of(this.mockTags);
        }),
      ),
    );
  }

  createGlobalTag(name: string, category: string, icon: string = '✨'): Promise<HobbyTag> {
    const formattedName = name
      .trim()
      .split(/\s+/)
      .map((word, index) => {
        if (index === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    return firstValueFrom(
      this.http.post<HobbyTag>(this.apiUrl, { name: formattedName, category, icon }).pipe(
        catchError(() => {
          const newTag: HobbyTag = {
            id: `tag-${Date.now()}`,
            name: formattedName,
            category,
            icon,
            target_vocabulary: [],
            created_at: new Date().toISOString(),
          };
          this.mockTags.push(newTag);
          return of(newTag);
        }),
      ),
    );
  }

  getMyTags(): Promise<UserHobbyTag[]> {
    return firstValueFrom(
      this.http
        .get<UserHobbyTag[]>(`${this.apiUrl}/my`)
        .pipe(catchError(() => of([...this.mockUserTags]))),
    );
  }

  addMyTag(hobbyTagId: string, proficiencyLevel?: number): Promise<UserHobbyTag> {
    return firstValueFrom(
      this.http
        .post<UserHobbyTag>(`${this.apiUrl}/my`, {
          hobby_tag_id: hobbyTagId,
          proficiency_level: proficiencyLevel,
        })
        .pipe(
          catchError(() => {
            const tag = this.mockTags.find((t) => t.id === hobbyTagId);
            if (!tag) return of();
            const existing = this.mockUserTags.find((ut) => ut.hobby_tag_id === hobbyTagId);
            if (existing) return of(existing);
            const newTag: UserHobbyTag = {
              id: `ut-${Date.now()}`,
              user_id: 'me',
              hobby_tag_id: hobbyTagId,
              proficiency_level: proficiencyLevel || 0,
              created_at: new Date().toISOString(),
              hobby_tag: tag,
            };
            this.mockUserTags.push(newTag);
            return of(newTag);
          }),
        ),
    );
  }

  removeMyTag(hobbyTagId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/my/${hobbyTagId}`).pipe(
        catchError(() => {
          this.mockUserTags = this.mockUserTags.filter((t) => t.hobby_tag_id !== hobbyTagId);
          return of({ success: true });
        }),
      ),
    );
  }

  updateProficiency(hobbyTagId: string, level: number): Promise<UserHobbyTag> {
    return firstValueFrom(
      this.http
        .patch<UserHobbyTag>(`${this.apiUrl}/my/${hobbyTagId}/proficiency`, {
          proficiency_level: level,
        })
        .pipe(
          catchError(() => {
            const tag = this.mockUserTags.find((t) => t.hobby_tag_id === hobbyTagId);
            if (tag) {
              tag.proficiency_level = level;
              return of(tag);
            }
            return of();
          }),
        ),
    );
  }

  getVocabulary(language: string): Promise<VocabularyItem[]> {
    return firstValueFrom(
      this.http
        .get<Array<VocabularyItem>>(`${this.apiUrl}/vocabulary`, {
          params: { language },
        })
        .pipe(
          catchError(() => {
            const result: VocabularyItem[] = [];
            for (const ut of this.mockUserTags) {
              if (!ut.hobby_tag) continue;
              const tag = ut.hobby_tag;
              const hobby_tag_info = { icon: tag.icon, name: tag.name };
              const context_sentence = `Learn this word from your ${tag.name} hobby vocabulary.`;
              for (const vocab of tag.target_vocabulary) {
                if (!language || vocab.language === language) {
                  result.push({
                    id: `vocab-${tag.id}-${vocab.word}`,
                    word: vocab.word,
                    translation: vocab.translation,
                    hobbyTagName: tag.name,
                    difficulty: 'beginner',
                    context_sentence,
                    hobby_tag: hobby_tag_info,
                  });
                }
              }
            }
            return of(result);
          }),
        ),
    );
  }
}
