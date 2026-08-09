import { Component, inject, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuestStore } from '../../services/quests.store';

@Component({
  selector: 'app-quests',
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="p-4 bg-surface text-start" role="region" aria-label="{{ 'quests.title' | t }}">
      <h2 class="text-xl font-bold mb-4">{{ 'quests.title' | t }}</h2>
      @if (store.loading()) {
        <p role="status" aria-live="polite">{{ 'quests.loading' | t }}</p>
      } @else {
        <ul class="space-y-3" role="list" aria-label="{{ 'quests.listLabel' | t }}">
          @for (quest of store.quests(); track quest.id) {
            <li
              class="p-3 rounded-lg"
              role="listitem"
              [class.bg-success]="quest.completed"
              [class.bg-surface-alt]="!quest.completed"
              [attr.aria-label]="('quests.' + quest.quest_type + '_' + quest.quest_key | t) + ', ' + ('quests.progress' | t) + ': ' + quest.progress + ' ' + ('common.of' | t) + ' ' + quest.target + ', ' + ('quests.reward' | t) + ': ' + quest.reward_coins + ' ' + ('common.coins' | t) + (quest.completed ? ', ' + ('quests.completedStatus' | t) : '')"
            >
              <div class="flex justify-between items-center">
                <span class="font-medium">{{ 'quests.' + quest.quest_type + '_' + quest.quest_key | t }}</span>
                <span class="text-sm text-muted" aria-hidden="true">
                  {{ quest.progress }} / {{ quest.target }}
                </span>
              </div>
              <div
                class="mt-1 w-full bg-accent/20 rounded-full h-2"
                role="progressbar"
                [attr.aria-valuenow]="quest.progress"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="quest.target"
                [attr.aria-label]="('quests.progressLabel' | t) + ': ' + quest.progress + ' ' + ('common.of' | t) + ' ' + quest.target"
              >
                <div
                  class="bg-accent h-2 rounded-full transition-all duration-300"
                  [style.width.%]="quest.progress / quest.target * 100"
                ></div>
              </div>
              <div class="text-xs text-muted mt-1">
                {{ 'quests.reward' | t }}: {{ quest.reward_coins }} {{ 'common.coins' | t }}
              </div>
            </li>
          } @empty {
            <li role="status" aria-live="polite">{{ 'quests.empty' | t }}</li>
          }
        </ul>
      }
    </div>
  `,
})
export class QuestsComponent {
  store = inject(QuestStore);

  // Use resource() for initial data loading instead of ngOnInit()
  private questsResource = resource({
    loader: async () => {
      await this.store.fetchQuests();
    },
  });
}
