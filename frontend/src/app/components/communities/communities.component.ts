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
    <main
      aria-labelledby="communities-title"
      class="min-h-full bg-surface-500 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
    >
      <section class="mx-auto w-full max-w-5xl">
        <header class="mb-6 sm:mb-8">
          <h1 id="communities-title" class="text-2xl font-bold text-text-primary sm:text-3xl">
            {{ 'communities.title' | t }}
          </h1>
        </header>

        <form
          (ngSubmit)="create()"
          class="grid gap-3 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] lg:items-end"
        >
          <label class="min-w-0">
            <span class="sr-only">{{ 'communities.nameLabel' | t }}</span>
            <input
              hlmInput
              [(ngModel)]="newName"
              name="name"
              required
              class="w-full min-w-0 rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary"
              placeholder="{{ 'communities.namePlaceholder' | t }}"
            />
          </label>
          <label class="min-w-0">
            <span class="sr-only">{{ 'communities.descriptionLabel' | t }}</span>
            <input
              hlmInput
              [(ngModel)]="newDescription"
              name="description"
              placeholder="{{ 'communities.descriptionPlaceholder' | t }}"
              class="w-full min-w-0 rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary"
            />
          </label>
          <button
            hlmBtn
            type="submit"
            size="touch"
            class="w-full rounded-app bg-primary p-2 text-on-fill transition-colors hover:bg-primary/90 md:col-span-2 lg:col-span-1 lg:w-auto"
          >
            {{ 'communities.create' | t }}
          </button>
        </form>

        @if (communities(); as list) {
          <ul class="mt-6 grid gap-3 md:grid-cols-2">
            @for (community of list; track community.id) {
              <li
                class="min-w-0 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-5"
              >
                <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <span class="min-w-0 break-words font-semibold text-text-primary">
                    {{ community.name }}
                  </span>
                  <button
                    hlmBtn
                    type="button"
                    size="touch"
                    (click)="delete(community.id)"
                    class="w-full text-danger sm:w-auto"
                  >
                    <span>{{ 'communities.delete' | t }}</span>
                    <span class="sr-only">{{ community.name }}</span>
                  </button>
                </div>
                @if (community.description) {
                  <p class="mt-2 break-words text-sm text-text-secondary">
                    {{ community.description }}
                  </p>
                }
              </li>
            } @empty {
              <li
                class="col-span-full rounded-card border border-surface-100 bg-surface-200 p-6 text-center text-text-secondary shadow-card"
              >
                {{ 'communities.empty' | t }}
              </li>
            }
          </ul>
        }
      </section>
    </main>
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