import { CommonModule } from '@angular/common';
import { Component, inject, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { Quest, QuestStore } from '../../services/quests.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-quests',
  imports: [CommonModule, HlmButton, TranslatePipe],
  template: `
    <div
      class="p-4 bg-surface text-start"
      role="region"
      aria-label="{{ 'quests.title' | t }}"
      [attr.aria-busy]="store.loading()"
    >
      <h2 class="text-xl font-bold mb-4">{{ 'quests.title' | t }}</h2>
      @if (store.loading() && store.quests().length === 0) {
        <p role="status" aria-live="polite">{{ 'quests.loading' | t }}</p>
      } @else {
        @if (store.error()) {
          <div class="mb-3 flex flex-wrap items-center gap-2" role="alert">
            <span>{{ 'common.error' | t }}</span>
            <button
              hlmBtn
              type="button"
              variant="outline"
              size="touch"
              [disabled]="store.loading()"
              (click)="retry()"
            >
              {{ 'common.retry' | t }}
            </button>
          </div>
        }
        <ul class="space-y-3" role="list" aria-label="{{ 'quests.listLabel' | t }}">
          @for (quest of store.quests(); track quest.id) {
            <li
              class="p-3 rounded-lg"
              role="listitem"
              [class.bg-success]="quest.completed"
              [class.bg-surface-alt]="!quest.completed"
              [attr.aria-label]="('quests.' + quest.quest_type + '_' + quest.quest_key | t) + ', ' + ('quests.progress' | t) + ': ' + quest.progress + ' ' + ('common.of' | t) + ' ' + quest.target + ', ' + ('quests.reward' | t) + ': ' + quest.reward_coins + ' ' + ('common.coins' | t) + (quest.completed ? ', ' + ('quests.completedStatus' | t) : '')"
            >
              <div class="flex justify-between items-center gap-3">
                <span class="font-medium">{{ 'quests.' + quest.quest_type + '_' + quest.quest_key | t }}</span>
                <span class="text-sm text-muted shrink-0" aria-hidden="true">
                  {{ quest.progress }} / {{ quest.target }}
                </span>
              </div>
              <div
                class="mt-1 w-full bg-accent/20 rounded-full h-2"
                role="progressbar"
                [attr.aria-valuenow]="clampedProgress(quest)"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="quest.target"
                [attr.aria-label]="('quests.progressLabel' | t) + ': ' + clampedProgress(quest) + ' ' + ('common.of' | t) + ' ' + quest.target"
              >
                <div
                  class="bg-accent h-2 rounded-full transition-all duration-300"
                  [style.width.%]="progressPercent(quest)"
                ></div>
              </div>
              <div class="text-xs text-muted mt-1">
                {{ 'quests.reward' | t }}: {{ quest.reward_coins }} {{ 'common.coins' | t }}
              </div>
            </li>
          } @empty {
            @if (!store.error()) {
              <li role="status" aria-live="polite">{{ 'quests.empty' | t }}</li>
            }
          }
        </ul>
      }
    </div>
  `,
})
export class QuestsComponent {
  readonly store = inject(QuestStore);

  private readonly questsResource = resource({
    loader: async () => {
      await this.store.fetchQuests();
    },
  });

  retry(): void {
    if (this.store.loading()) return;
    void this.store.fetchQuests();
  }

  clampedProgress(quest: Quest): number {
    if (!Number.isFinite(quest.progress) || quest.target <= 0) return 0;
    return Math.max(0, Math.min(quest.progress, quest.target));
  }

  progressPercent(quest: Quest): number {
    if (!Number.isFinite(quest.target) || quest.target <= 0) return 0;
    return (this.clampedProgress(quest) / quest.target) * 100;
  }
}
