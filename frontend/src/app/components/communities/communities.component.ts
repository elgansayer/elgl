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
      <form (ngSubmit)="create()" class="mb-6 flex gap-2" [attr.aria-busy]="creating()">
        <label class="sr-only" for="community-name">{{ 'communities.nameLabel' | t }}</label>
        <input hlmInput
          id="community-name"
          [(ngModel)]="newName"
          name="name"
          required
          [disabled]="mutationPending()"
          class="rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="{{ 'communities.namePlaceholder' | t }}"
        />
        <label class="sr-only" for="community-description">{{ 'communities.descriptionLabel' | t }}</label>
        <input hlmInput
          id="community-description"
          [(ngModel)]="newDescription"
          name="description"
          [disabled]="mutationPending()"
          placeholder="{{ 'communities.descriptionPlaceholder' | t }}"
          class="rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button hlmBtn
          type="submit"
          [disabled]="mutationPending()"
          class="bg-primary text-on-fill rounded-app p-2 hover:bg-primary/90 transition-colors"
        >
          {{ 'communities.create' | t }}
        </button>
      </form>
      @if (communities(); as list) {
        <ul [attr.aria-busy]="deletingId() !== null">
          @for (community of list; track community.id) {
            <li class="border border-surface-100 rounded-app p-4 mb-2">
              <div class="flex justify-between">
                <span class="font-semibold text-text-primary">{{ community.name }}</span>
                <button
                  hlmBtn
                  type="button"
                  (click)="delete(community.id)"
                  [disabled]="mutationPending()"
                  class="text-danger"
                >
                  {{ 'communities.delete' | t }}
                  <span class="sr-only">{{ community.name }}</span>
                </button>
              </div>
              @if (community.description) {
                <p class="mt-1 text-sm text-text-secondary">{{ community.description }}</p>
              }
            </li>
          } @empty {
            <li class="list-none text-text-secondary">{{ 'communities.empty' | t }}</li>
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
  readonly creating = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly mutationPending = computed(() => this.creating() || this.deletingId() !== null);

  private readonly communitiesResource = resource({
    loader: () => this.communitiesService.listMine(),
  });

  readonly communities = computed(() => this.communitiesResource.value() ?? []);

  async create(): Promise<void> {
    if (this.mutationPending()) return;

    const name = this.newName().trim();
    if (!name) return;
    const description = this.newDescription().trim();

    this.creating.set(true);
    try {
      await this.communitiesService.create({
        name,
        description: description || undefined,
      });
      this.newName.set('');
      this.newDescription.set('');
      this.communitiesResource.reload();
    } finally {
      this.creating.set(false);
    }
  }

  async delete(id: string): Promise<void> {
    if (this.mutationPending()) return;

    this.deletingId.set(id);
    try {
      await this.communitiesService.remove(id);
      this.communitiesResource.reload();
    } finally {
      this.deletingId.set(null);
    }
  }
}
