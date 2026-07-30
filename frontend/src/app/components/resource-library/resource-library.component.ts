import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { ResourceLibraryService, ResourceItem } from '../../services/resource-library.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-resource-library',
  standalone: true,
  imports: [CommonModule, TranslatePipe, FormsModule],
  template: `
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'resource_library.title' | t }}</h1>

      <!-- Filter controls -->
      <div class="mb-4 flex flex-wrap gap-2">
        <select
          [(ngModel)]="filterTopic"
          name="filterTopic"
          class="p-2 border rounded"
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
          class="p-2 border rounded"
        >
          <option value="">{{ 'resource_library.all_difficulties' | t }}</option>
          <option value="beginner">{{ 'resource_library.difficulty_beginner' | t }}</option>
          <option value="intermediate">{{ 'resource_library.difficulty_intermediate' | t }}</option>
          <option value="advanced">{{ 'resource_library.difficulty_advanced' | t }}</option>
        </select>
        <button
          (click)="applyFilter()"
          class="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {{ 'resource_library.filter' | t }}
        </button>
      </div>

      <!-- Group by controls -->
      <div class="mb-4 flex flex-wrap gap-2 items-center">
        <span class="text-sm font-semibold">{{ 'resource_library.group_label' | t }}</span>
        <button
          (click)="groupBy.set('none')"
          [class.bg-blue-600]="groupBy() === 'none'"
          [class.text-white]="groupBy() === 'none'"
          class="px-3 py-1 rounded border me-2"
        >
          {{ 'resource_library.group_none' | t }}
        </button>
        <button
          (click)="groupBy.set('topic')"
          [class.bg-blue-600]="groupBy() === 'topic'"
          [class.text-white]="groupBy() === 'topic'"
          class="px-3 py-1 rounded border me-2"
        >
          {{ 'resource_library.group_by_topic' | t }}
        </button>
        <button
          (click)="groupBy.set('difficulty')"
          [class.bg-blue-600]="groupBy() === 'difficulty'"
          [class.text-white]="groupBy() === 'difficulty'"
          class="px-3 py-1 rounded border"
        >
          {{ 'resource_library.group_by_difficulty' | t }}
        </button>
      </div>

      <!-- Create / Edit form -->
      <form (ngSubmit)="onSubmit()" class="mb-6 space-y-2 border p-4 rounded">
        <input
          [(ngModel)]="newTitle"
          name="title"
          placeholder="{{ 'resource_library.title_placeholder' | t }}"
          class="w-full p-2 border rounded"
          required
        />
        <textarea
          [(ngModel)]="newDescription"
          name="description"
          placeholder="{{ 'resource_library.description_placeholder' | t }}"
          class="w-full p-2 border rounded"
        ></textarea>
        <input
          [(ngModel)]="newUrl"
          name="url"
          type="url"
          placeholder="{{ 'resource_library.url_placeholder' | t }}"
          class="w-full p-2 border rounded"
          required
        />
        <input
          [(ngModel)]="newCategory"
          name="category"
          placeholder="{{ 'resource_library.category_placeholder' | t }}"
          class="w-full p-2 border rounded"
        />
        <select
          [(ngModel)]="newType"
          name="type"
          class="w-full p-2 border rounded"
        >
          <option value="">{{ 'resource_library.type_placeholder' | t }}</option>
          <option value="post">{{ 'resource_library.type_post' | t }}</option>
          <option value="tip">{{ 'resource_library.type_tip' | t }}</option>
        </select>
        <select
          [(ngModel)]="newTopic"
          name="newTopic"
          class="w-full p-2 border rounded"
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
          class="w-full p-2 border rounded"
        >
          <option value="">{{ 'resource_library.difficulty_placeholder' | t }}</option>
          <option value="beginner">{{ 'resource_library.difficulty_beginner' | t }}</option>
          <option value="intermediate">{{ 'resource_library.difficulty_intermediate' | t }}</option>
          <option value="advanced">{{ 'resource_library.difficulty_advanced' | t }}</option>
        </select>
        <textarea
          [(ngModel)]="newContent"
          name="content"
          placeholder="{{ 'resource_library.content_placeholder' | t }}"
          class="w-full p-2 border rounded"
        ></textarea>
        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">
          {{ 'resource_library.save' | t }}
        </button>
      </form>

      @if (groupBy() === 'none') {
        @if (filteredResources(); as items) {
          <div class="space-y-2">
            @for (resource of items; track resource.id) {
              <div class="border rounded p-3 flex justify-between items-start">
                <div>
                  <a [href]="resource.url" target="_blank" class="text-blue-500 underline">{{ resource.title }}</a>
                  <p class="text-sm text-gray-600">{{ resource.description }}</p>
                  @if (resource.type) {
                    <span class="text-xs font-semibold bg-gray-200 rounded px-1 py-0.5">{{ resource.type }}</span>
                  }
                  @if (resource.content) {
                    <p class="text-xs text-gray-500 mt-1 italic">{{ resource.content | slice:0:100 }}{{ resource.content.length > 100 ? '...' : '' }}</p>
                  }
                  <span class="text-xs text-gray-400">{{ resource.category }}</span>
                  @if (resource.topic) {
                    <span class="text-xs font-semibold bg-blue-100 text-blue-700 rounded px-1 py-0.5 ms-1">{{ resource.topic }}</span>
                  }
                  @if (resource.difficulty) {
                    <span class="text-xs font-semibold bg-green-100 text-green-700 rounded px-1 py-0.5 ms-1">{{ resource.difficulty }}</span>
                  }
                </div>
                <div class="flex gap-2">
                  <button (click)="onEdit(resource)" class="text-yellow-500">{{ 'resource_library.edit' | t }}</button>
                  <button (click)="onDelete(resource.id)" class="text-red-500">{{ 'resource_library.delete' | t }}</button>
                </div>
              </div>
            }
          </div>
        }
      } @else {
        @if (collectionGroups(); as groups) {
          @for (group of groups; track group.key) {
            <div class="mb-4">
              <h2 class="font-semibold text-lg mb-2">{{ group.key | t }}</h2>
              <div class="space-y-2">
                @for (resource of group.items; track resource.id) {
                  <div class="border rounded p-3 flex justify-between items-start">
                    <div>
                      <a [href]="resource.url" target="_blank" class="text-blue-500 underline">{{ resource.title }}</a>
                      <p class="text-sm text-gray-600">{{ resource.description }}</p>
                      @if (resource.type) {
                        <span class="text-xs font-semibold bg-gray-200 rounded px-1 py-0.5">{{ resource.type }}</span>
                      }
                      @if (resource.content) {
                        <p class="text-xs text-gray-500 mt-1 italic">{{ resource.content | slice:0:100 }}{{ resource.content.length > 100 ? '...' : '' }}</p>
                      }
                      <span class="text-xs text-gray-400">{{ resource.category }}</span>
                      @if (resource.topic) {
                        <span class="text-xs font-semibold bg-blue-100 text-blue-700 rounded px-1 py-0.5 ms-1">{{ resource.topic }}</span>
                      }
                      @if (resource.difficulty) {
                        <span class="text-xs font-semibold bg-green-100 text-green-700 rounded px-1 py-0.5 ms-1">{{ resource.difficulty }}</span>
                      }
                    </div>
                    <div class="flex gap-2">
                      <button (click)="onEdit(resource)" class="text-yellow-500">{{ 'resource_library.edit' | t }}</button>
                      <button (click)="onDelete(resource.id)" class="text-red-500">{{ 'resource_library.delete' | t }}</button>
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
