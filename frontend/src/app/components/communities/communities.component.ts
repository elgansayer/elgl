import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { CommunitiesService } from '../../services/communities.service';

@Component({
  selector: 'app-communities',
  imports: [HlmInput, HlmButton, FormsModule, TranslatePipe],
  template: `
    <div class="p-4">
      <h1 class="text-2xl font-bold mb-4 text-text-primary">{{ 'communities.title' | t }}</h1>
      <form (ngSubmit)="create()" class="mb-6 flex gap-2">
        <input hlmInput
          [(ngModel)]="newName"
          name="name"
          required
          class="rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="{{ 'communities.namePlaceholder' | t }}"
        />
        <input hlmInput
          [(ngModel)]="newDescription"
          name="description"
          placeholder="{{ 'communities.descriptionPlaceholder' | t }}"
          class="rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button hlmBtn
          type="submit"
          class="bg-primary text-on-fill rounded-app p-2 hover:bg-primary/90 transition-colors"
        >
          {{ 'communities.create' | t }}
        </button>
      </form>
      @if (communities(); as list) {
        <ul>
          @for (community of list; track community.id) {
            <li class="border border-surface-100 rounded-app p-4 mb-2">
              <div class="flex justify-between">
                <span class="font-semibold text-text-primary">{{ community.name }}</span>
                <button hlmBtn (click)="delete(community.id)" class="text-danger">
                  {{ 'communities.delete' | t }}
                </button>
              </div>
              @if (community.description) {
                <p class="mt-1 text-sm text-text-secondary">{{ community.description }}</p>
              }
            </li>
          } @empty {
            <p class="text-text-secondary">{{ 'communities.empty' | t }}</p>
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
