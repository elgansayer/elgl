import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuestStore } from '../../services/quests.store';

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="p-4 bg-surface text-start">
      <h2 class="text-xl font-bold mb-4">{{ 'quests.title' | t }}</h2>
      @if (store.loading()) {
        <p>{{ 'quests.loading' | t }}</p>
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
            <p>{{ 'quests.empty' | t }}</p>
          }
        </ul>
      }
    </div>
  `,
})
export class QuestsComponent implements OnInit {
  store = inject(QuestStore);

  ngOnInit(): void {
    this.store.fetchQuests();
  }
}
