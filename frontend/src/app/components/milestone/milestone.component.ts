import { Component, inject, effect, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { MilestoneService } from '../../services/milestone.service';

@Component({
  selector: 'app-milestone',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="p-4">
      <h2 class="text-xl font-bold">{{ 'milestones.title' | t }}</h2>

      <div class="mb-4">
        <span class="text-sm text-text-secondary">{{ 'milestones.progress' | t }}: </span>
        <span class="text-sm font-semibold">{{ milestoneService.progress().percentage }}%</span>
      </div>

      @for (ms of milestoneService.milestones(); track ms.id) {
        <div class="my-2 p-2 bg-surface rounded flex items-center justify-between">
          <span>{{ ms.title }}</span>
          <span [class.text-green-500]="ms.completed">{{ ms.completed ? '✓' : '○' }}</span>
        </div>
      } @empty {
        <p>{{ 'milestones.empty' | t }}</p>
      }
    </div>
  `,
})
export class MilestoneComponent {
  milestoneService = inject(MilestoneService);

  constructor() {
    afterNextRender(() => {
      this.milestoneService.fetchMilestones();
      this.milestoneService.getProgress();
    });
  }
}
