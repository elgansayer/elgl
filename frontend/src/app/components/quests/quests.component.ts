import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuestStore } from '../../services/quests.store';

@Component({
  selector: 'app-quests',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="p-4 bg-[#121212] min-h-screen">
      <h2 class="text-xl sm:text-2xl font-bold text-white mb-4">{{ 'quests.title' | t }}</h2>
      @if (store.loading()) {
        <div class="flex items-center justify-center py-20">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
          <span class="ms-3 text-neutral-400">{{ 'quests.loading' | t }}</span>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (quest of store.quests(); track quest.id) {
            <li
              class="p-4 rounded-xl border transition-colors"
              [class.bg-emerald-500/10]="quest.completed"
              [class.border-emerald-500/30]="quest.completed"
              [class.bg-neutral-800]="!quest.completed"
              [class.border-neutral-700]="!quest.completed"
            >
              <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span class="font-medium text-white text-sm">{{ 'quests.' + quest.quest_type + '_' + quest.quest_key | t }}</span>
                <span class="text-xs text-neutral-400 shrink-0">
                  {{ quest.progress }} / {{ quest.target }}
                </span>
              </div>
              <div class="mt-2 w-full bg-neutral-700 rounded-full h-2 overflow-hidden">
                <div
                  class="h-2 rounded-full transition-all duration-300"
                  [class.bg-emerald-500]="quest.completed"
                  [class.bg-indigo-500]="!quest.completed"
                  [style.width.%]="quest.progress / quest.target * 100"
                ></div>
              </div>
              <div class="text-xs text-neutral-400 mt-1.5">
                {{ 'quests.reward' | t }}: <span class="text-amber-400 font-semibold">{{ quest.reward_coins }}</span> {{ 'coins' | t }}
              </div>
            </li>
          } @empty {
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <p class="text-neutral-400 text-sm">{{ 'quests.empty' | t }}</p>
            </div>
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
