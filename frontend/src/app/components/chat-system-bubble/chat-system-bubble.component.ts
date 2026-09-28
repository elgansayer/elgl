import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

interface SystemEventConfig {
  icon: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

const EVENT_CONFIGS: Record<string, SystemEventConfig> = {
  profileUpdated: {
    icon: '\ud83d\udc64',
    bgClass: 'bg-secondary/10',
    borderClass: 'border-secondary/30',
    textClass: 'text-secondary',
  },
  missedCall: {
    icon: '\ud83d\udcde',
    bgClass: 'bg-danger/10',
    borderClass: 'border-danger/30',
    textClass: 'text-danger',
  },
  groupRenamed: {
    icon: '\u270f\ufe0f',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    textClass: 'text-warning',
  },
  memberAdded: {
    icon: '\ud83d\udc4b',
    bgClass: 'bg-success/10',
    borderClass: 'border-success/30',
    textClass: 'text-success',
  },
  memberRemoved: {
    icon: '\ud83d\udeaa',
    bgClass: 'bg-surface-200',
    borderClass: 'border-surface-100',
    textClass: 'text-text-secondary',
  },
  announcement: {
    icon: '\ud83d\udce2',
    bgClass: 'bg-accent/10',
    borderClass: 'border-accent/30',
    textClass: 'text-accent',
  },
};

const DEFAULT_CONFIG: SystemEventConfig = {
  icon: '\ud83d\udd14',
  bgClass: 'bg-surface-200',
  borderClass: 'border-surface-100',
  textClass: 'text-text-secondary',
};

@Component({
  selector: 'app-chat-system-bubble',
  imports: [TranslatePipe],
  template: `
    <div class="flex justify-center my-2" role="status">
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border"
        [class]="config().bgClass + ' ' + config().borderClass + ' ' + config().textClass"
      >
        <span aria-hidden="true" class="text-xs leading-none">{{ config().icon }}</span>
        <span>{{ i18nKey() | t: params() }}</span>
      </span>
    </div>
  `,
})
export class ChatSystemBubbleComponent {
  eventType = input.required<string>();
  params = input<Record<string, unknown>>({});

  readonly i18nKey = computed(() => `system.${this.eventType()}`);
  readonly config = computed<SystemEventConfig>(
    () => EVENT_CONFIGS[this.eventType()] ?? DEFAULT_CONFIG,
  );
}
