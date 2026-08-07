import { Component, inject, OnInit } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuestStore } from '../../services/quests.store';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [TranslatePipe, AppSkeletonLoaderComponent, AppEmptyStateComponent],
  template: `
    <div class="p-4 bg-surface text-start">
      <h2 class="text-xl font-bold mb-4">{{ 'quests.title' | t }}</h2>
      @if (store.loading()) {
        <div class="space-y-3">
          @for (skeleton of skeletons; track skeleton) {
            <div class="p-3 rounded-lg bg-surface-alt space-y-2.5">
              <div class="flex justify-between items-center">
                <app-skeleton-loader height="16px" width="60%" borderRadius="4px" />
                <app-skeleton-loader height="14px" width="20%" borderRadius="4px" />
              </div>
              <app-skeleton-loader height="8px" width="100%" borderRadius="4px" />
              <app-skeleton-loader height="10px" width="30%" borderRadius="4px" />
            </div>
          }
        </div>
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
          } @empty {
            <app-empty-state
              icon="&#x1F3AF;"
              [title]="'quests.emptyTitle' | t"
              [description]="'quests.emptyDescription' | t"
            />
          }
        </ul>
      }
    </div>
  `,
})
export class QuestsComponent implements OnInit {
  store = inject(QuestStore);
  protected readonly skeletons = [1, 2, 3];

  ngOnInit(): void {
    this.store.fetchQuests();
  }
}
