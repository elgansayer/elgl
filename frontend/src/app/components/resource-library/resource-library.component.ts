import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { ResourceLibraryService, ResourceItem } from '../../services/resource-library.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-resource-library',
  imports: [CommonModule, TranslatePipe, FormsModule],
  template: `
    <div class="p-2 sm:p-4 md:p-6 max-w-5xl mx-auto">
      <h1 class="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">{{ 'resource_library.title' | t }}</h1>

      <!-- Filter controls -->
      <div class="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        <select
          [(ngModel)]="filterTopic"
          name="filterTopic"
          class="p-1.5 sm:p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-xs sm:text-sm min-h-[40px] sm:min-h-0"
        >
          <option value="">{{ 'resource_library.all_topics' | t }}</option>
          <option value="grammar">{{ 'resource_library.topic_grammar' | t }}</option>
          <option value="vocabulary">{{ 'resource_library.topic_vocabulary' | t }}</option>
          <option value="pronunciation">{{ 'resource_library.topic_pronunciation' | t }}</option>
          <option value="reading">{{ 'resource_library.topic_reading' | t }}</option>
        </select>
        <select
          [(ngModel)]="filterDifficulty"
          name="filterDifficulty"
          class="p-1.5 sm:p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-xs sm:text-sm min-h-[40px] sm:min-h-0"
        >
          <option value="">{{ 'resource_library.all_difficulties' | t }}</option>
          <option value="beginner">{{ 'resource_library.difficulty_beginner' | t }}</option>
          <option value="intermediate">{{ 'resource_library.difficulty_intermediate' | t }}</option>
          <option value="advanced">{{ 'resource_library.difficulty_advanced' | t }}</option>
        </select>
        <button
          (click)="applyFilter()"
          class="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-app text-xs sm:text-sm font-semibold min-h-[40px] sm:min-h-0"
        >
          {{ 'resource_library.filter' | t }}
        </button>
      </div>

      <!-- Group by controls -->
      <div class="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2 items-center">
        <span class="text-xs sm:text-sm font-semibold text-text-secondary">{{ 'resource_library.group_label' | t }}</span>
        <button
          (click)="groupBy.set('none')"
          [class.bg-blue-600]="groupBy() === 'none'"
          [class.text-white]="groupBy() === 'none'"
          class="px-2 sm:px-3 py-1 rounded-app border border-surface-200 text-xs sm:text-sm text-text-primary min-h-[36px] sm:min-h-0"
        >
          {{ 'resource_library.group_none' | t }}
        </button>
        <button
          (click)="groupBy.set('topic')"
          [class.bg-blue-600]="groupBy() === 'topic'"
          [class.text-white]="groupBy() === 'topic'"
          class="px-2 sm:px-3 py-1 rounded-app border border-surface-200 text-xs sm:text-sm text-text-primary min-h-[36px] sm:min-h-0"
        >
          {{ 'resource_library.group_by_topic' | t }}
        </button>
        <button
          (click)="groupBy.set('difficulty')"
          [class.bg-blue-600]="groupBy() === 'difficulty'"
          [class.text-white]="groupBy() === 'difficulty'"
          class="px-2 sm:px-3 py-1 rounded-app border border-surface-200 text-xs sm:text-sm text-text-primary min-h-[36px] sm:min-h-0"
        >
          {{ 'resource_library.group_by_difficulty' | t }}
        </button>
      </div>

      <!-- Create / Edit form -->
      <form (ngSubmit)="onSubmit()" class="mb-4 sm:mb-6 space-y-2 border border-surface-100 bg-surface-300 p-3 sm:p-4 rounded-card">
        <input
          [(ngModel)]="newTitle"
          name="title"
          placeholder="{{ 'resource_library.title_placeholder' | t }}"
          class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          required
        />
        <textarea
          [(ngModel)]="newDescription"
          name="description"
          placeholder="{{ 'resource_library.description_placeholder' | t }}"
          class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          rows="2"
        ></textarea>
        <input
          [(ngModel)]="newUrl"
          name="url"
          type="url"
          placeholder="{{ 'resource_library.url_placeholder' | t }}"
          class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          required
        />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            [(ngModel)]="newCategory"
            name="category"
            placeholder="{{ 'resource_library.category_placeholder' | t }}"
            class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          />
          <select
            [(ngModel)]="newType"
            name="type"
            class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          >
            <option value="">{{ 'resource_library.type_placeholder' | t }}</option>
            <option value="post">{{ 'resource_library.type_post' | t }}</option>
            <option value="tip">{{ 'resource_library.type_tip' | t }}</option>
          </select>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            [(ngModel)]="newTopic"
            name="newTopic"
            class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          >
            <option value="">{{ 'resource_library.topic_placeholder' | t }}</option>
            <option value="grammar">{{ 'resource_library.topic_grammar' | t }}</option>
            <option value="vocabulary">{{ 'resource_library.topic_vocabulary' | t }}</option>
            <option value="pronunciation">{{ 'resource_library.topic_pronunciation' | t }}</option>
            <option value="reading">{{ 'resource_library.topic_reading' | t }}</option>
          </select>
          <select
            [(ngModel)]="newDifficulty"
            name="newDifficulty"
            class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          >
            <option value="">{{ 'resource_library.difficulty_placeholder' | t }}</option>
            <option value="beginner">{{ 'resource_library.difficulty_beginner' | t }}</option>
            <option value="intermediate">{{ 'resource_library.difficulty_intermediate' | t }}</option>
            <option value="advanced">{{ 'resource_library.difficulty_advanced' | t }}</option>
          </select>
        </div>
        <textarea
          [(ngModel)]="newContent"
          name="content"
          placeholder="{{ 'resource_library.content_placeholder' | t }}"
          class="w-full p-2 border border-surface-200 bg-surface-200 text-text-primary rounded-app text-sm min-h-[40px]"
          rows="2"
        ></textarea>
        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-app text-sm font-semibold min-h-[44px]">
          {{ 'resource_library.save' | t }}
        </button>
      </form>

      @if (groupBy() === 'none') {
        @if (filteredResources(); as items) {
          <div class="space-y-2">
            @for (resource of items; track resource.id) {
              <div class="border border-surface-100 bg-surface-300 rounded-card p-2 sm:p-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div class="min-w-0 flex-1">
                  <a [href]="resource.url" target="_blank" class="text-blue-400 underline text-sm sm:text-base font-semibold break-all">{{ resource.title }}</a>
                  <p class="text-xs sm:text-sm text-text-secondary mt-0.5">{{ resource.description }}</p>
                  <div class="flex flex-wrap gap-1 mt-1">
                    @if (resource.type) {
                      <span class="text-2xs sm:text-xs font-semibold bg-surface-200 text-text-secondary rounded px-1.5 py-0.5">{{ resource.type }}</span>
                    }
                    <span class="text-2xs sm:text-xs text-text-muted">{{ resource.category }}</span>
                    @if (resource.topic) {
                      <span class="text-2xs sm:text-xs font-semibold bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5">{{ resource.topic }}</span>
                    }
                    @if (resource.difficulty) {
                      <span class="text-2xs sm:text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">{{ resource.difficulty }}</span>
                    }
                  </div>
                  @if (resource.content) {
                    <p class="text-2xs sm:text-xs text-text-muted mt-1 italic line-clamp-2">{{ resource.content }}</p>
                  }
                </div>
                <div class="flex gap-2 self-end sm:self-start flex-shrink-0">
                  <button (click)="onEdit(resource)" class="text-amber-400 text-xs sm:text-sm font-semibold min-h-[36px] sm:min-h-0 px-2 py-0.5 rounded-app hover:bg-surface-200">{{ 'resource_library.edit' | t }}</button>
                  <button (click)="onDelete(resource.id)" class="text-red-400 text-xs sm:text-sm font-semibold min-h-[36px] sm:min-h-0 px-2 py-0.5 rounded-app hover:bg-surface-200">{{ 'resource_library.delete' | t }}</button>
                </div>
              </div>
            }
          </div>
        }
      } @else {
        @if (collectionGroups(); as groups) {
          @for (group of groups; track group.key) {
            <div class="mb-3 sm:mb-4">
              <h2 class="font-semibold text-base sm:text-lg mb-2 text-text-primary">{{ group.key | t }}</h2>
              <div class="space-y-2">
                @for (resource of group.items; track resource.id) {
                  <div class="border border-surface-100 bg-surface-300 rounded-card p-2 sm:p-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div class="min-w-0 flex-1">
                      <a [href]="resource.url" target="_blank" class="text-blue-400 underline text-sm sm:text-base font-semibold break-all">{{ resource.title }}</a>
                      <p class="text-xs sm:text-sm text-text-secondary mt-0.5">{{ resource.description }}</p>
                      <div class="flex flex-wrap gap-1 mt-1">
                        @if (resource.type) {
                          <span class="text-2xs sm:text-xs font-semibold bg-surface-200 text-text-secondary rounded px-1.5 py-0.5">{{ resource.type }}</span>
                        }
                        <span class="text-2xs sm:text-xs text-text-muted">{{ resource.category }}</span>
                        @if (resource.topic) {
                          <span class="text-2xs sm:text-xs font-semibold bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5">{{ resource.topic }}</span>
                        }
                        @if (resource.difficulty) {
                          <span class="text-2xs sm:text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">{{ resource.difficulty }}</span>
                        }
                      </div>
                      @if (resource.content) {
                        <p class="text-2xs sm:text-xs text-text-muted mt-1 italic line-clamp-2">{{ resource.content }}</p>
                      }
                    </div>
                    <div class="flex gap-2 self-end sm:self-start flex-shrink-0">
                      <button (click)="onEdit(resource)" class="text-amber-400 text-xs sm:text-sm font-semibold min-h-[36px] sm:min-h-0 px-2 py-0.5 rounded-app hover:bg-surface-200">{{ 'resource_library.edit' | t }}</button>
                      <button (click)="onDelete(resource.id)" class="text-red-400 text-xs sm:text-sm font-semibold min-h-[36px] sm:min-h-0 px-2 py-0.5 rounded-app hover:bg-surface-200">{{ 'resource_library.delete' | t }}</button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class ResourceLibraryComponent implements OnInit {
  private resourceService = inject(ResourceLibraryService);

  resources = signal<ResourceItem[]>([]);
  filteredResources = signal<ResourceItem[]>([]);

  readonly groupBy = signal<'none' | 'topic' | 'difficulty'>('none');
  readonly collectionGroups = computed<{ key: string; items: ResourceItem[] }[] | null>(() => {
    const items = this.filteredResources();
    const groupKey = this.groupBy();
    if (groupKey === 'none') return null;

    const map = new Map<string, ResourceItem[]>();
    for (const item of items) {
      const key = groupKey === 'topic'
        ? (item.topic ?? 'resource_library.uncategorised')
        : (item.difficulty ?? 'resource_library.uncategorised');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    let keys: string[];
    if (groupKey === 'difficulty') {
      const order = ['beginner', 'intermediate', 'advanced'];
      const custom = order.filter(k => map.has(k));
      const rest = Array.from(map.keys()).filter(k => !order.includes(k)).sort();
      keys = [...custom, ...rest];
    } else {
      keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    }

    return keys.map(key => ({ key, items: map.get(key)! }));
  });

  newTitle = '';
  newDescription = '';
  newUrl = '';
  newCategory = '';
  newType = '';
  newContent = '';
  newTopic = '';
  newDifficulty = '';

  editingId: string | null = null;

  filterTopic = '';
  filterDifficulty = '';

  async ngOnInit(): Promise<void> {
    await this.loadResources();
  }

  private async loadResources(): Promise<void> {
    const items = await this.resourceService.getAll();
    this.resources.set(items);
    this.applyFilter();
  }

  applyFilter(): void {
    const topic = this.filterTopic;
    const difficulty = this.filterDifficulty;
    const items = this.resources();
    const filtered = items.filter(
      (r) =>
        (!topic || r.topic === topic) &&
        (!difficulty || r.difficulty === difficulty),
    );
    this.filteredResources.set(filtered);
  }

  async onSubmit(): Promise<void> {
    const payload = {
      title: this.newTitle,
      description: this.newDescription,
      url: this.newUrl,
      category: this.newCategory,
      type: this.newType || undefined,
      content: this.newContent || undefined,
      topic: this.newTopic || undefined,
      difficulty: this.newDifficulty || undefined,
    };
    if (this.editingId) {
      await this.resourceService.update(this.editingId, payload);
      this.editingId = null;
    } else {
      await this.resourceService.create(payload);
    }
    this.resetForm();
    await this.loadResources();
  }

  onEdit(resource: ResourceItem): void {
    this.editingId = resource.id;
    this.newTitle = resource.title;
    this.newDescription = resource.description ?? '';
    this.newUrl = resource.url;
    this.newCategory = resource.category ?? '';
    this.newType = resource.type ?? '';
    this.newContent = resource.content ?? '';
    this.newTopic = resource.topic ?? '';
    this.newDifficulty = resource.difficulty ?? '';
  }

  async onDelete(id: string): Promise<void> {
    await this.resourceService.delete(id);
    await this.loadResources();
  }

  private resetForm(): void {
    this.newTitle = '';
    this.newDescription = '';
    this.newUrl = '';
    this.newCategory = '';
    this.newType = '';
    this.newContent = '';
    this.newTopic = '';
    this.newDifficulty = '';
    this.editingId = null;
  }
}
