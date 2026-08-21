import { Component, computed, signal, inject, resource, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
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
  imports: [
    FormsModule,
    AppCardComponent,
    AppPillComponent,
    TranslatePipe,
    ...HlmButtonImports,
    ...HlmInputImports,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-text-primary">{{ 'hobby.title' | t }}</h2>
        <button
          hlmBtn
          type="button"
          variant="secondary"
          size="touch"
          (click)="showAddPanel.set(!showAddPanel())"
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
                hlmInput
                id="hobby-search"
                type="text"
                [(ngModel)]="searchQuery"
                [placeholder]="'hobby.searchPlaceholder' | t"
              />
            </div>

            <div class="flex max-h-60 flex-wrap gap-2 overflow-y-auto">
              @for (tag of filteredTags(); track tag.id) {
                @if (!isTagAdded(tag.id)) {
                  <button
                    hlmBtn
                    type="button"
                    variant="secondary"
                    size="sm"
                    class="rounded-full"
                    (click)="addTag(tag.id)"
                    [attr.aria-label]="i18n.translate('hobby.addTagLabel', { name: tag.name })"
                  >
                    <span aria-hidden="true">{{ tag.icon }}</span>
                    <span>{{ tag.name }}</span>
                    <span class="text-xs text-text-muted" aria-hidden="true">+</span>
                  </button>
                }
              } @empty {
                <div class="flex w-full flex-col items-center gap-3 py-4">
                  <p class="text-sm text-text-muted">{{ 'hobby.noResults' | t }}</p>
                  @if (searchQuery().trim()) {
                    <button
                      hlmBtn
                      type="button"
                      size="touch"
                      (click)="createGlobalTag(searchQuery().trim())"
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
              [customClass]="'pe-8 cursor-pointer hover:ring-2 hover:ring-primary'"
            >
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true">{{ userTag.hobby_tag?.icon }}</span>
                <span>{{ userTag.hobby_tag?.name }}</span>
                <span class="text-xs opacity-60">{{
                  getProficiencyLabel(userTag.proficiency_level)
                }}</span>
              </span>
            </app-pill>
            <button
              hlmBtn
              type="button"
              variant="ghost"
              size="icon-xs"
              class="absolute end-1 top-1/2 -translate-y-1/2 rounded-full text-danger opacity-0 transition-opacity group-hover:opacity-100"
              (click)="removeTag(userTag.hobby_tag_id)"
              [attr.aria-label]="
                i18n.translate('hobby.removeTagLabel', { name: userTag.hobby_tag?.name ?? '' })
              "
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        } @empty {
          <p class="text-sm italic text-text-muted">
            {{ 'hobby.noHobbiesYet' | t }}
          </p>
        }
      </div>

      @if (selectedTagForProficiency()) {
        <app-card variant="outlined" customClass="p-4">
          <h3 class="mb-3 text-sm font-semibold text-text-secondary">
            {{
              i18n.translate('hobby.proficiencyFor', {
                name: getTagName(selectedTagForProficiency()!),
              })
            }}
          </h3>
          <div class="flex gap-2" role="radiogroup">
            @for (level of proficiencyLevels; track level; let idx = $index) {
              <button
                hlmBtn
                type="button"
                variant="ghost"
                size="sm"
                role="radio"
                (click)="updateProficiency(selectedTagForProficiency()!, level)"
                [attr.aria-checked]="getCurrentProficiency(selectedTagForProficiency()!) === level"
                [class.bg-primary]="getCurrentProficiency(selectedTagForProficiency()!) === level"
                [class.text-on-fill]="getCurrentProficiency(selectedTagForProficiency()!) === level"
              >
                {{ getProficiencyLabel(idx) }}
              </button>
            }
          </div>
        </app-card>
      }

      @if (userVocabulary().length > 0) {
        <div class="mt-6">
          <h3 class="mb-3 text-lg font-semibold text-text-primary">
            {{ 'hobby.vocabularyTitle' | t }}
          </h3>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (word of userVocabulary(); track word.id) {
              <app-card variant="outlined" customClass="p-3">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-sm font-semibold text-text-primary">{{ word.word }}</span>
                    <span class="ms-2 text-xs text-text-muted">{{ word.translation }}</span>
                  </div>
                </div>
                @if (word.context_sentence) {
                  <p class="mt-1 text-xs italic text-text-muted">{{ word.context_sentence }}</p>
                }
                @if (word.hobby_tag) {
                  <div class="mt-2 flex items-center gap-1 text-xs text-text-secondary">
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
    params: () => ({ lang: this.targetLanguage() }),
    loader: async ({ params }) => {
      const [allTags, userTags, vocab] = await Promise.all([
        this.hobbyTagsService.getAllTags(),
        this.hobbyTagsService.getMyTags(),
        this.hobbyTagsService.getVocabulary(params.lang),
      ]);
      this.allTags.set(allTags);
      this.userTags.set(userTags);
      this.userVocabulary.set(vocab);
    },
  });

  isTagAdded(tagId: string): boolean {
    return this.userTags().some((tag) => tag.hobby_tag_id === tagId);
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
    const tag = this.userTags().find((item) => item.hobby_tag_id === tagId);
    return tag?.hobby_tag?.name || '';
  }

  getCurrentProficiency(tagId: string): string {
    const tag = this.userTags().find((item) => item.hobby_tag_id === tagId);
    const level = tag?.proficiency_level || 0;
    return this.proficiencyLevels[level] || 'beginner';
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
