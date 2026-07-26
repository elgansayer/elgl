import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { HobbyTagsService, HobbyTag, UserHobbyTag } from '../../services/hobby-tags.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';

@Component({
  selector: 'app-hobby-tags',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCardComponent, AppPillComponent, TranslatePipe],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-text-primary">Hobbies & Interests</h2>
        <button
          (click)="showAddPanel.set(!showAddPanel())"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {{ showAddPanel() ? ('common.cancel' | t) : ('hobby.add' | t) }}
        </button>
      </div>

      <!-- Add Hobby Panel -->
      @if (showAddPanel()) {
        <app-card variant="elevated" customClass="p-4">
          <div class="space-y-4">
            <div class="relative">
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Search hobbies..."
                class="w-full px-4 py-2 bg-surface-800 border border-slate-600 rounded-lg text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div class="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
              @for (tag of filteredTags(); track tag.id) {
                @if (!isTagAdded(tag.id)) {
                  <button
                    (click)="addTag(tag.id)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-200 hover:bg-indigo-600 text-slate-200 rounded-full text-sm transition-colors"
                  >
                    <span>{{ tag.icon }}</span>
                    <span>{{ tag.name }}</span>
                    <span class="text-xs text-text-muted">+</span>
                  </button>
                }
              }
              @empty {
                <div class="w-full flex flex-col items-center gap-3 py-4">
                  <p class="text-text-muted text-sm">No hobbies found</p>
                  @if (searchQuery().trim()) {
                    <button
                      (click)="createGlobalTag(searchQuery().trim())"
                      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Create "{{ searchQuery().trim() }}"
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </app-card>
      }

      <!-- User's Hobby Tags -->
      <div class="flex flex-wrap gap-3">
        @for (userTag of userTags(); track userTag.id) {
          <div class="group relative">
            <app-pill
              [colour]="getProficiencyColour(userTag.proficiency_level)"
              [size]="'md'"
              [customClass]="'pe-8 cursor-pointer hover:ring-2 hover:ring-indigo-400'"
            >
              <span class="flex items-center gap-1.5">
                <span>{{ userTag.hobby_tag?.icon }}</span>
                <span>{{ userTag.hobby_tag?.name }}</span>
                <span class="text-xs opacity-60">{{ userTag.proficiency_level }}</span>
              </span>
            </app-pill>
            <button
              (click)="removeTag(userTag.hobby_tag_id)"
              class="absolute end-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all text-xs"
              title="Remove hobby"
            >
              ✕
            </button>
          </div>
        }
        @empty {
          <p class="text-text-muted text-sm italic">
            No hobbies added yet. Click "Add Hobby" to get started!
          </p>
        }
      </div>

      <!-- Proficiency Level Selector -->
      @if (selectedTagForProficiency()) {
        <app-card variant="outlined" customClass="p-4">
          <h3 class="text-sm font-semibold text-slate-300 mb-3">
            Proficiency Level for {{ getTagName(selectedTagForProficiency()!) }}
          </h3>
          <div class="flex gap-2">
            @for (level of proficiencyLevels; track level) {
              <button
                (click)="updateProficiency(selectedTagForProficiency()!, level)"
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                [class.bg-indigo-600]="getCurrentProficiency(selectedTagForProficiency()!) === level"
                [class.bg-surface-200]="getCurrentProficiency(selectedTagForProficiency()!) !== level"
                [class.text-white]="getCurrentProficiency(selectedTagForProficiency()!) === level"
                [class.text-slate-300]="getCurrentProficiency(selectedTagForProficiency()!) !== level"
              >
                {{ level | titlecase }}
              </button>
            }
          </div>
        </app-card>
      }

      <!-- Vocabulary Section -->
      @if (userVocabulary().length > 0) {
        <div class="mt-6">
          <h3 class="text-lg font-semibold text-slate-200 mb-3">
            Vocabulary from Your Hobbies
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (word of userVocabulary(); track word.id) {
              <app-card variant="outlined" customClass="p-3">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-sm font-semibold text-text-primary">{{ word.word }}</span>
                    <span class="text-xs text-text-muted ms-2">{{ word.translation }}</span>
                  </div>
                  <app-pill
                    [colour]="getDifficultyColour(word.difficulty)"
                    [size]="'sm'"
                  >
                    {{ word.difficulty }}
                  </app-pill>
                </div>
                @if (word.context_sentence) {
                  <p class="text-xs text-text-muted mt-1 italic">{{ word.context_sentence }}</p>
                }
                @if (word.hobby_tag) {
                  <div class="flex items-center gap-1 mt-2 text-xs text-text-secondary">
                    <span>{{ word.hobby_tag.icon }}</span>
                    <span>{{ word.hobby_tag.name }}</span>
                  </div>
                }
              </app-card>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class HobbyTagsComponent implements OnInit {
  readonly showAddPanel = signal(false);
  readonly searchQuery = signal('');
  readonly selectedTagForProficiency = signal<string | null>(null);

  readonly allTags = signal<HobbyTag[]>([]);
  readonly userTags = signal<UserHobbyTag[]>([]);
  readonly userVocabulary = signal<unknown[]>([]);

  readonly proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'native'];

  readonly filteredTags = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.allTags().filter(
      (tag) =>
        tag.name.toLowerCase().includes(query) ||
        tag.category.toLowerCase().includes(query)
    );
  });

  public hobbyTagsService = inject(HobbyTagsService);

  ngOnInit(): void {
    this.fetchAllTags();
    this.fetchUserTags();
    this.fetchUserVocabulary();
  }

  fetchAllTags(): void {
    this.hobbyTagsService.getAllTags().subscribe(tags => this.allTags.set(tags));
  }

  fetchUserTags(): void {
    this.hobbyTagsService.getMyTags().subscribe(tags => this.userTags.set(tags));
  }

  fetchUserVocabulary(): void {
    this.hobbyTagsService.getVocabulary('en').subscribe(vocab => this.userVocabulary.set(vocab));
  }

  isTagAdded(tagId: string): boolean {
    return this.userTags().some((t) => t.hobby_tag_id === tagId);
  }

  addTag(tagId: string): void {
    this.hobbyTagsService.addMyTag(tagId, 0).subscribe(() => this.fetchUserTags());
  }

  removeTag(tagId: string): void {
    this.hobbyTagsService.removeMyTag(tagId).subscribe(() => {
      this.fetchUserTags();
      if (this.selectedTagForProficiency() === tagId) {
        this.selectedTagForProficiency.set(null);
      }
    });
  }

  createGlobalTag(name: string): void {
    this.hobbyTagsService.createGlobalTag(name, 'Other', '✨').subscribe((newTag) => {
      this.fetchAllTags();
      this.addTag(newTag.id);
      this.searchQuery.set('');
    });
  }

  updateProficiency(tagId: string, level: string): void {
    const levelNum = this.proficiencyLevels.indexOf(level);
    this.hobbyTagsService.updateProficiency(tagId, levelNum).subscribe(() => this.fetchUserTags());
  }

  getTagName(tagId: string): string {
    const tag = this.userTags().find(
      (t) => t.hobby_tag_id === tagId
    );
    return tag?.hobby_tag?.name || '';
  }

  getCurrentProficiency(tagId: string): string {
    const tag = this.userTags().find(
      (t) => t.hobby_tag_id === tagId
    );
    const lvl = tag?.proficiency_level || 0;
    return this.proficiencyLevels[lvl] || 'beginner';
  }

  getProficiencyColour(level: number): 'success' | 'warning' | 'info' | 'primary' | 'neutral' {
    switch (level) {
      case 0: return 'success';
      case 1: return 'warning';
      case 2: return 'info';
      case 3: return 'primary';
      default: return 'neutral';
    }
  }

  getDifficultyColour(difficulty: string): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'danger';
      default: return 'neutral';
    }
  }
}
