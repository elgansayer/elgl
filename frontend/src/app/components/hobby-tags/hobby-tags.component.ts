import { Component, computed, signal, inject, resource, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { FormsModule } from '@angular/forms';
import {
  HobbyTagsService,
  HobbyTag,
  UserHobbyTag,
  VocabularyItem,
} from '../../services/hobby-tags.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';

@Component({
  selector: 'app-hobby-tags',
  imports: [FormsModule, AppCardComponent, AppPillComponent, TranslatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-text-primary">{{ 'hobby.title' | t }}</h2>
        <button
          (click)="showAddPanel.set(!showAddPanel())"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {{ showAddPanel() ? ('common.cancel' | t) : ('hobby.add' | t) }}
        </button>
      </div>

      @if (showAddPanel()) {
        <app-card variant="elevated" customClass="p-4">
          <div class="space-y-4">
            <div class="relative">
              <label for="hobby-search" class="sr-only">{{ 'hobby.searchLabel' | t }}</label>
              <input
                id="hobby-search"
                type="text"
                [(ngModel)]="searchQuery"
                [placeholder]="'hobby.searchPlaceholder' | t"
                class="w-full px-4 py-2 bg-surface-800 border border-slate-600 rounded-lg text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div class="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
              @for (tag of filteredTags(); track tag.id) {
                @if (!isTagAdded(tag.id)) {
                  <button
                    (click)="addTag(tag.id)"
                    [attr.aria-label]="i18n.translate('hobby.addTagLabel', { name: tag.name })"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-200 hover:bg-indigo-600 text-slate-200 rounded-full text-sm transition-colors"
                  >
                    <span aria-hidden="true">{{ tag.icon }}</span>
                    <span>{{ tag.name }}</span>
                    <span class="text-xs text-text-muted" aria-hidden="true">+</span>
                  </button>
                }
              } @empty {
                <div class="w-full flex flex-col items-center gap-3 py-4">
                  <p class="text-text-muted text-sm">{{ 'hobby.noResults' | t }}</p>
                  @if (searchQuery().trim()) {
                    <button
                      (click)="createGlobalTag(searchQuery().trim())"
                      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {{ i18n.translate('hobby.createTag', { name: searchQuery().trim() }) }}
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </app-card>
      }

      <div class="flex flex-wrap gap-3">
        @for (userTag of userTags(); track userTag.id) {
          <div class="group relative">
            <app-pill
              [colour]="getProficiencyColour(userTag.proficiency_level)"
              [size]="'md'"
              [customClass]="'pe-8 cursor-pointer hover:ring-2 hover:ring-indigo-400'"
            >
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true">{{ userTag.hobby_tag?.icon }}</span>
                <span>{{ userTag.hobby_tag?.name }}</span>
                <span class="text-xs opacity-60">{{ getProficiencyLabel(userTag.proficiency_level) }}</span>
              </span>
            </app-pill>
            <button
              (click)="removeTag(userTag.hobby_tag_id)"
              class="absolute end-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all text-xs"
              [attr.aria-label]="
                i18n.translate('hobby.removeTagLabel', { name: userTag.hobby_tag?.name ?? '' })
              "
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        } @empty {
          <p class="text-text-muted text-sm italic">
            {{ 'hobby.noHobbiesYet' | t }}
          </p>
        }
      </div>

      @if (selectedTagForProficiency()) {
        <app-card variant="outlined" customClass="p-4">
          <h3 class="text-sm font-semibold text-slate-300 mb-3">
            {{ i18n.translate('hobby.proficiencyFor', { name: getTagName(selectedTagForProficiency()!) }) }}
          </h3>
          <div class="flex gap-2">
            @for (level of proficiencyLevels; track level; let idx = $index) {
              <button
                (click)="updateProficiency(selectedTagForProficiency()!, level)"
                [attr.aria-pressed]="getCurrentProficiency(selectedTagForProficiency()!) === level"
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                [class.bg-indigo-600]="
                  getCurrentProficiency(selectedTagForProficiency()!) === level
                "
                [class.bg-surface-200]="
                  getCurrentProficiency(selectedTagForProficiency()!) !== level
                "
                [class.text-white]="getCurrentProficiency(selectedTagForProficiency()!) === level"
                [class.text-slate-300]="
                  getCurrentProficiency(selectedTagForProficiency()!) !== level
                "
              >
                {{ getProficiencyLabel(idx) }}
              </button>
            }
          </div>
        </app-card>
      }

      @if (userVocabulary().length > 0) {
        <div class="mt-6">
          <h3 class="text-lg font-semibold text-slate-200 mb-3">{{ 'hobby.vocabularyTitle' | t }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (word of userVocabulary(); track word.id) {
              <app-card variant="outlined" customClass="p-3">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-sm font-semibold text-text-primary">{{ word.word }}</span>
                    <span class="text-xs text-text-muted ms-2">{{ word.translation }}</span>
                  </div>
                </div>
                @if (word.context_sentence) {
                  <p class="text-xs text-text-muted mt-1 italic">{{ word.context_sentence }}</p>
                }
                @if (word.hobby_tag) {
                  <div class="flex items-center gap-1 mt-2 text-xs text-text-secondary">
                    <span aria-hidden="true">{{ word.hobby_tag.icon }}</span>
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
export class HobbyTagsComponent {
  readonly targetLanguage = input('en');

  readonly showAddPanel = signal(false);
  readonly searchQuery = signal('');
  readonly selectedTagForProficiency = signal<string | null>(null);

  readonly allTags = signal<HobbyTag[]>([]);
  readonly userTags = signal<UserHobbyTag[]>([]);
  readonly userVocabulary = signal<VocabularyItem[]>([]);

  readonly proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'native'];

  readonly filteredTags = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.allTags().filter(
      (tag) => tag.name.toLowerCase().includes(query) || tag.category.toLowerCase().includes(query),
    );
  });

  public hobbyTagsService = inject(HobbyTagsService);
  public readonly i18n = inject(I18nService);

  private dataLoader = resource({
    request: () => ({ lang: this.targetLanguage() }),
    loader: async ({ request }) => {
      const [allTags, userTags, vocab] = await Promise.all([
        this.hobbyTagsService.getAllTags(),
        this.hobbyTagsService.getMyTags(),
        this.hobbyTagsService.getVocabulary(request.lang),
      ]);
      this.allTags.set(allTags);
      this.userTags.set(userTags);
      this.userVocabulary.set(vocab);
    },
  });

  isTagAdded(tagId: string): boolean {
    return this.userTags().some((t) => t.hobby_tag_id === tagId);
  }

  async addTag(tagId: string): Promise<void> {
    await this.hobbyTagsService.addMyTag(tagId, 0);
    this.dataLoader.reload();
  }

  async removeTag(tagId: string): Promise<void> {
    await this.hobbyTagsService.removeMyTag(tagId);
    if (this.selectedTagForProficiency() === tagId) {
      this.selectedTagForProficiency.set(null);
    }
    this.dataLoader.reload();
  }

  async createGlobalTag(name: string): Promise<void> {
    const newTag = await this.hobbyTagsService.createGlobalTag(name, 'Other', '✨');
    await this.hobbyTagsService.addMyTag(newTag.id, 0);
    this.searchQuery.set('');
    this.dataLoader.reload();
  }

  async updateProficiency(tagId: string, level: string): Promise<void> {
    const levelNum = this.proficiencyLevels.indexOf(level);
    await this.hobbyTagsService.updateProficiency(tagId, levelNum);
    this.dataLoader.reload();
  }

  getTagName(tagId: string): string {
    const tag = this.userTags().find((t) => t.hobby_tag_id === tagId);
    return tag?.hobby_tag?.name || '';
  }

  getCurrentProficiency(tagId: string): string {
    const tag = this.userTags().find((t) => t.hobby_tag_id === tagId);
    const lvl = tag?.proficiency_level || 0;
    return this.proficiencyLevels[lvl] || 'beginner';
  }

  getProficiencyLabel(level: number): string {
    const keys = [
      'hobby.proficiencyBeginner',
      'hobby.proficiencyIntermediate',
      'hobby.proficiencyAdvanced',
      'hobby.proficiencyNative',
    ];
    return this.i18n.translate(keys[level] || keys[0]);
  }

  getProficiencyColour(level: number): 'success' | 'warning' | 'info' | 'primary' | 'neutral' {
    switch (level) {
      case 0:
        return 'success';
      case 1:
        return 'warning';
      case 2:
        return 'info';
      case 3:
        return 'primary';
      default:
        return 'neutral';
    }
  }
}
