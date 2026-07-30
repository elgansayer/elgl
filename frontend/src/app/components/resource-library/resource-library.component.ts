import { Component, inject, OnInit, signal } from '@angular/core';
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

      @if (resources(); as items) {
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
              </div>
              <div class="flex gap-2">
                <button (click)="onEdit(resource)" class="text-yellow-500">{{ 'resource_library.edit' | t }}</button>
                <button (click)="onDelete(resource.id)" class="text-red-500">{{ 'resource_library.delete' | t }}</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ResourceLibraryComponent implements OnInit {
  private resourceService = inject(ResourceLibraryService);

  resources = signal<ResourceItem[]>([]);

  newTitle = '';
  newDescription = '';
  newUrl = '';
  newCategory = '';
  newType = '';
  newContent = '';

  editingId: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadResources();
  }

  private async loadResources(): Promise<void> {
    this.resources.set(await this.resourceService.getAll());
  }

  async onSubmit(): Promise<void> {
    const payload = {
      title: this.newTitle,
      description: this.newDescription,
      url: this.newUrl,
      category: this.newCategory,
      type: this.newType || undefined,
      content: this.newContent || undefined,
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
    this.editingId = null;
  }
}
