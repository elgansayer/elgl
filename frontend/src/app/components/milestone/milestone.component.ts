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
    <div class="p-4">
      <h2 class="text-xl font-bold text-text-primary">{{ 'milestones.title' | t }}</h2>

      <div class="mt-4">
        <div class="flex items-center justify-between text-sm mb-1">
          <span class="text-text-secondary">{{ 'milestones.progress' | t }}</span>
          <span class="font-semibold text-text-primary">{{ progress().percentage }}%</span>
        </div>
        <div
          class="h-2 w-full rounded-full bg-surface-200 overflow-hidden"
          role="progressbar"
          [attr.aria-valuenow]="progress().percentage"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="'milestones.progress' | t"
        >
          <div
            class="h-full bg-primary transition-all"
            [style.width.%]="progress().percentage"
          ></div>
        </div>
      </div>

      <form class="mt-6 space-y-2" (submit)="addMilestone($event)">
        <div>
          <label for="milestone-title" class="block text-sm font-medium text-text-secondary">
            {{ 'milestones.titleLabel' | t }}
          </label>
          <input
            hlmInput
            id="milestone-title"
            type="text"
            required
            [value]="newTitle()"
            (input)="newTitle.set($any($event.target).value)"
            [attr.placeholder]="'milestones.titlePlaceholder' | t"
            class="mt-1 w-full ps-3 pe-3 py-2 rounded-lg border border-surface-100 bg-surface-200 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label for="milestone-description" class="block text-sm font-medium text-text-secondary">
            {{ 'milestones.descriptionLabel' | t }}
          </label>
          <input
            hlmInput
            id="milestone-description"
            type="text"
            [value]="newDescription()"
            (input)="newDescription.set($any($event.target).value)"
            [attr.placeholder]="'common.optional' | t"
            class="mt-1 w-full ps-3 pe-3 py-2 rounded-lg border border-surface-100 bg-surface-200 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          hlmBtn
          type="submit"
          [disabled]="!newTitle().trim() || creating()"
          class="px-4 py-2 bg-primary text-on-fill rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {{ 'milestones.addBtn' | t }}
        </button>
      </form>

      @if (milestonesData.isLoading()) {
        <p class="mt-4 text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (milestonesData.error()) {
        <p class="mt-4 text-danger">{{ 'common.loadError' | t }}</p>
      } @else {
        <div class="mt-4">
          @for (ms of milestones(); track ms.id) {
            <div class="my-2 p-3 bg-surface-200 rounded-lg flex items-center justify-between gap-3">
              <div>
                <p class="font-medium text-text-primary" [class.line-through]="ms.completed">
                  {{ ms.title }}
                </p>
                @if (ms.description) {
                  <p class="text-sm text-text-secondary">{{ ms.description }}</p>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                @if (!ms.completed) {
                  <button
                    hlmBtn
                    type="button"
                    (click)="complete(ms.id)"
                    [attr.aria-label]="'milestones.completeBtn' | t"
                    class="px-3 py-1 text-sm bg-primary text-on-fill rounded-md"
                  >
                    {{ 'milestones.completeBtn' | t }}
                  </button>
                } @else {
                  <span class="text-success" aria-hidden="true">&check;</span>
                  <span class="sr-only">{{ 'milestones.completedStatus' | t }}</span>
                }
                <button
                  hlmBtn
                  type="button"
                  (click)="remove(ms.id)"
                  [attr.aria-label]="'milestones.removeBtn' | t"
                  class="px-3 py-1 text-sm text-danger hover:text-danger/80"
                >
                  {{ 'milestones.removeBtn' | t }}
                </button>
              </div>
            </div>
          } @empty {
            <p class="text-text-secondary">{{ 'milestones.empty' | t }}</p>
          }
        </div>
      }
    </div>
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
