import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuestStore } from '../../services/quests.store';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `
    <div class="p-4 bg-surface text-start">
      <h2 class="text-xl font-bold mb-4">{{ 'quests.title' | t }}</h2>
      @if (store.loading()) {
        <div class="space-y-3" aria-hidden="true">
          @for (sk of skeletonCount; track sk) {
            <div class="p-3 rounded-lg bg-surface-alt">
              <div class="flex justify-between items-center">
                <app-skeleton-loader height="16px" width="60%" borderRadius="4px" />
                <app-skeleton-loader height="14px" width="50px" borderRadius="4px" variant="text" />
              </div>
              <app-skeleton-loader height="8px" width="100%" borderRadius="9999px" customClass="mt-2" />
              <app-skeleton-loader height="12px" width="30%" borderRadius="4px" variant="text" customClass="mt-1" />
            </div>
          }
        </div>
      } @else if (store.quests().length === 0) {
        <app-empty-state
          icon="&#x1F3AF;"
          [title]="'quests.emptyTitle' | t"
          [description]="'quests.emptyDescription' | t"
        />
      } @else {
        <ul class="space-y-3">
          @for (quest of store.quests(); track quest.id) {
            <li
              class="p-3 rounded-lg"
              [class.bg-success]="quest.completed"
              [class.bg-surface-alt]="!quest.completed"
            >
              <div class="flex justify-between items-center">
                <span class="font-medium">{{ 'quests.' + quest.quest_type + '_' + quest.quest_key | t }}</span>
                <span class="text-sm text-muted">
                  {{ quest.progress }} / {{ quest.target }}
                </span>
              </div>
              <div class="mt-1 w-full bg-accent/20 rounded-full h-2">
                <div
                  class="bg-accent h-2 rounded-full transition-all duration-300"
                  [style.width.%]="quest.progress / quest.target * 100"
                ></div>
              </div>
              <div class="text-xs text-muted mt-1">
                {{ 'quests.reward' | t }}: {{ quest.reward_coins }} {{ 'coins' | t }}
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class QuestsComponent {
  store = inject(QuestStore);
  readonly skeletonCount = Array.from({ length: 3 }, (_, i) => i);

  constructor() {
    this.store.fetchQuests();
  }
}
