import { Component, inject, signal, computed, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { CommunitiesService, Community } from '../../services/communities.service';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="p-4">
      <h1 class="text-2xl font-bold mb-4">{{ 'communities.title' | t }}</h1>
      <form (ngSubmit)="create()" class="mb-6 flex gap-2">
        <input
          [(ngModel)]="newName"
          name="name"
          required
          class="border rounded p-2"
          placeholder="{{ 'communities.namePlaceholder' | t }}"
        />
        <input
          [(ngModel)]="newDescription"
          name="description"
          placeholder="{{ 'communities.descriptionPlaceholder' | t }}"
          class="border rounded p-2"
        />
        <button type="submit" class="bg-blue-500 text-white rounded p-2">
          {{ 'communities.create' | t }}
        </button>
      </form>
      @if (communities(); as list) {
        <ul>
          @for (community of list; track community.id) {
            <li class="border rounded p-4 mb-2">
              <div class="flex justify-between">
                <span class="font-semibold">{{ community.name }}</span>
                <button (click)="delete(community.id)" class="text-red-500">
                  {{ 'communities.delete' | t }}
                </button>
              </div>
              @if (community.description) {
                <p class="mt-1 text-sm">{{ community.description }}</p>
              }
            </li>
          } @empty {
            <p>{{ 'communities.empty' | t }}</p>
          }
        </ul>
      }
    </div>
  `,
})
export class CommunitiesComponent {
  private readonly communitiesService = inject(CommunitiesService);
  readonly newName = signal('');
  readonly newDescription = signal('');

  private readonly communitiesResource = resource({
    loader: () => this.communitiesService.listMine(),
  });

  readonly communities = computed(() => this.communitiesResource.value() ?? []);

  async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    const description = this.newDescription().trim();
    await this.communitiesService.create({
      name,
      description: description || undefined,
    });
    this.newName.set('');
    this.newDescription.set('');
    this.communitiesResource.reload();
  }

  async delete(id: string): Promise<void> {
    await this.communitiesService.remove(id);
    this.communitiesResource.reload();
  }
}
