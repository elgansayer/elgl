import { Component, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-message-context-menu',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-col bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm min-w-[150px]">
      <button class="px-4 py-2 text-start hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" (click)="translate.emit()">
        {{ 'chat.menu.translate' | t }}
      </button>
      <button class="px-4 py-2 text-start hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" (click)="transliterate.emit()">
        {{ 'chat.menu.transliterate' | t }}
      </button>
      <button class="px-4 py-2 text-start hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" (click)="speak.emit()">
        {{ 'chat.menu.speak' | t }}
      </button>
      <button class="px-4 py-2 text-start hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" (click)="correct.emit()">
        {{ 'chat.menu.correct' | t }}
      </button>
    </div>
  `
})
export class MessageContextMenuComponent {
  translate = output<void>();
  transliterate = output<void>();
  speak = output<void>();
  correct = output<void>();
}
