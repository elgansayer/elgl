import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SystemMessage } from '../../services/system-message.service';

@Component({
  selector: 'app-system-message-bubble',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div
      class="flex items-center gap-2 my-2 px-3 py-2 bg-yellow-100/70 dark:bg-yellow-800/30 rounded-lg border border-yellow-400 text-sm"
    >
      <span class="text-lg">🔔</span>
      <span class="flex-1">
        @if (message.i18nKey) {
          {{ message.i18nKey | translate: message.i18nArgs }}
        } @else {
          {{ message.text }}
        }
      </span>
      @if (message.createdAt) {
        <span class="text-xs opacity-60 whitespace-nowrap">{{
          message.createdAt | date : 'shortTime'
        }}</span>
      }
    </div>
  `,
  styles: [],
})
export class SystemMessageBubbleComponent {
  @Input({ required: true }) message!: SystemMessage;
}
