import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, resource, signal, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { MilestoneService, Milestone, MilestoneProgress } from '../../services/milestone.service';

const EMPTY_PROGRESS: MilestoneProgress = { total: 0, completed: 0, percentage: 0 };

@Component({
  selector: 'app-milestone',
  imports: [HlmInput, HlmButton, TranslatePipe],
  template: `
    <section class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <h2 class="text-xl font-bold text-text-primary sm:text-2xl">{{ 'milestones.title' | t }}</h2>

      <div class="mt-4 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-5">
        <div class="mb-1 flex items-center justify-between gap-3 text-sm">
          <span class="text-text-secondary">{{ 'milestones.progress' | t }}</span>
          <span class="font-semibold text-text-primary">{{ progress().percentage }}%</span>
        </div>
        <div
          class="h-2 w-full overflow-hidden rounded-pill bg-surface-100"
          role="progressbar"
          [attr.aria-valuenow]="progress().percentage"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="'milestones.progress' | t"
        >
          <div
            class="h-full bg-primary transition-[width] motion-reduce:transition-none"
            [style.width.%]="progress().percentage"
          ></div>
        </div>
      </div>

      <form
        class="mt-6 grid gap-3 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-5"
        (submit)="addMilestone($event)"
      >
        <label class="min-w-0">
          <span class="block text-sm font-medium text-text-secondary">
            {{ 'milestones.titleLabel' | t }}
          </span>
          <input
            hlmInput
            type="text"
            required
            [value]="newTitle()"
            (input)="newTitle.set($any($event.target).value)"
            [attr.placeholder]="'milestones.titlePlaceholder' | t"
            class="mt-1 w-full min-w-0 rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary"
          />
        </label>
        <label class="min-w-0">
          <span class="block text-sm font-medium text-text-secondary">
            {{ 'milestones.descriptionLabel' | t }}
          </span>
          <input
            hlmInput
            type="text"
            [value]="newDescription()"
            (input)="newDescription.set($any($event.target).value)"
            [attr.placeholder]="'common.optional' | t"
            class="mt-1 w-full min-w-0 rounded-app border border-surface-100 bg-surface-300 p-2 text-text-primary"
          />
        </label>
        <button
          hlmBtn
          size="touch"
          type="submit"
          [disabled]="!newTitle().trim() || creating()"
          class="min-h-11 w-full rounded-app bg-primary text-on-fill transition-colors hover:bg-primary/90 sm:w-fit"
        >
          {{ 'milestones.addBtn' | t }}
        </button>
      </form>

      @if (milestonesData.isLoading()) {
        <p class="mt-4 text-text-secondary" role="status">{{ 'common.loading' | t }}</p>
      } @else if (milestonesData.error()) {
        <p class="mt-4 text-danger" role="alert">{{ 'common.loadError' | t }}</p>
      } @else {
        <div class="mt-4 grid gap-3">
          @for (ms of milestones(); track ms.id) {
            <article
              class="min-w-0 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-5"
            >
              <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <p class="break-words font-medium text-text-primary" [class.line-through]="ms.completed">
                    {{ ms.title }}
                  </p>
                  @if (ms.description) {
                    <p class="mt-1 break-words text-sm text-text-secondary">{{ ms.description }}</p>
                  }
                </div>
                <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  @if (!ms.completed) {
                    <button
                      hlmBtn
                      size="touch"
                      type="button"
                      (click)="complete(ms.id)"
                      [attr.aria-label]="'milestones.completeBtn' | t"
                      class="min-h-11 w-full rounded-app bg-primary text-on-fill sm:w-auto"
                    >
                      {{ 'milestones.completeBtn' | t }}
                    </button>
                  } @else {
                    <span class="self-center text-success" aria-hidden="true">&check;</span>
                    <span class="sr-only">{{ 'milestones.completedStatus' | t }}</span>
                  }
                  <button
                    hlmBtn
                    size="touch"
                    variant="outline"
                    type="button"
                    (click)="remove(ms.id)"
                    [attr.aria-label]="'milestones.removeBtn' | t"
                    class="min-h-11 w-full text-danger sm:w-auto"
                  >
                    {{ 'milestones.removeBtn' | t }}
                  </button>
                </div>
              </div>
            </article>
          } @empty {
            <div class="rounded-card border border-surface-100 bg-surface-200 p-4 text-text-secondary shadow-card sm:p-5">
              {{ 'milestones.empty' | t }}
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class MilestoneComponent {
  private milestoneService = inject(MilestoneService);

  readonly newTitle = signal('');
  readonly newDescription = signal('');
  readonly creating = signal(false);

  protected milestonesData = resource({
    loader: async (): Promise<{ milestones: Milestone[]; progress: MilestoneProgress }> => {
      const [milestones, progress] = await Promise.all([
        this.milestoneService.getMilestones(),
        this.milestoneService.getProgress(),
      ]);
      return { milestones, progress };
    },
  });

  readonly milestones = computed(() => this.milestonesData.value()?.milestones ?? []);
  readonly progress = computed(() => this.milestonesData.value()?.progress ?? EMPTY_PROGRESS);

  async addMilestone(event: Event): Promise<void> {
    event.preventDefault();
    const title = this.newTitle().trim();
    if (!title) return;

    this.creating.set(true);
    try {
      await this.milestoneService.createMilestone(title, this.newDescription().trim() || undefined);
      this.newTitle.set('');
      this.newDescription.set('');
      this.milestonesData.reload();
    } finally {
      this.creating.set(false);
    }
  }

  async complete(id: string): Promise<void> {
    await this.milestoneService.markCompleted(id);
    this.milestonesData.reload();
  }

  async remove(id: string): Promise<void> {
    await this.milestoneService.deleteMilestone(id);
    this.milestonesData.reload();
  }
}
