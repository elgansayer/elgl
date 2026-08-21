import { Injectable, inject, signal, computed } from '@angular/core';
import { HobbyTagsService, HobbyTag, UserHobbyTag, VocabularyItem } from './hobby-tags.service';

@Injectable({
  providedIn: 'root',
})
export class HobbyTagsStore {
  private readonly hobbyTagsService = inject(HobbyTagsService);

  readonly allTags = signal<HobbyTag[]>([]);
  readonly userTags = signal<UserHobbyTag[]>([]);
  readonly vocabulary = signal<VocabularyItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly tagsByCategory = computed(() => {
    const tags = this.allTags();
    const map = new Map<string, HobbyTag[]>();
    for (const tag of tags) {
      const existing = map.get(tag.category) || [];
      existing.push(tag);
      map.set(tag.category, existing);
    }
    return map;
  });

  readonly userTagIds = computed(() => new Set(this.userTags().map((ut) => ut.hobby_tag_id)));

  readonly vocabularyByTag = computed(() => {
    const vocab = this.vocabulary();
    const map = new Map<string, VocabularyItem[]>();
    for (const item of vocab) {
      const existing = map.get(item.hobbyTagName) || [];
      existing.push(item);
      map.set(item.hobbyTagName, existing);
    }
    return map;
  });

  constructor() {
    this.loadAllTags();
  }

  loadAllTags(): void {
    this.loading.set(true);
    this.hobbyTagsService.getAllTags().then(
      (tags) => {
        this.allTags.set(tags);
        this.loading.set(false);
      },
      (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    );
  }

  loadUserTags(): void {
    this.loading.set(true);
    this.hobbyTagsService.getMyTags().then(
      (tags) => {
        this.userTags.set(tags);
        this.loading.set(false);
      },
      (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    );
  }

  addTag(hobbyTagId: string, proficiencyLevel?: number): void {
    this.loading.set(true);
    this.hobbyTagsService.addMyTag(hobbyTagId, proficiencyLevel).then(
      (userTag) => {
        this.userTags.update((tags) => [...tags, userTag]);
        this.loading.set(false);
      },
      (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    );
  }

  removeTag(hobbyTagId: string): void {
    this.loading.set(true);
    this.hobbyTagsService.removeMyTag(hobbyTagId).then(
      () => {
        this.userTags.update((tags) => tags.filter((t) => t.hobby_tag_id !== hobbyTagId));
        this.loading.set(false);
      },
      (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    );
  }

  updateProficiency(hobbyTagId: string, level: number): void {
    this.loading.set(true);
    this.hobbyTagsService.updateProficiency(hobbyTagId, level).then(
      (updated) => {
        this.userTags.update((tags) =>
          tags.map((t) => (t.hobby_tag_id === hobbyTagId ? updated : t)),
        );
        this.loading.set(false);
      },
      (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    );
  }

  loadVocabulary(language: string): void {
    this.loading.set(true);
    this.hobbyTagsService.getVocabulary(language).then(
      (vocab) => {
        this.vocabulary.set(vocab);
        this.loading.set(false);
      },
      (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : String(err));
        this.loading.set(false);
      },
    );
  }
}
