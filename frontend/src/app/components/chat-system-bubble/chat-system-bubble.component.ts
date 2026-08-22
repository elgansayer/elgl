import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

interface SystemEventConfig {
  icon: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  requiredParam?: 'name' | 'count' | 'message';
}

const MAX_SYSTEM_EVENT_PARAM_LENGTH = 500;
const MAX_SYSTEM_EVENT_PARAMS = 12;

const EVENT_CONFIGS: Record<string, SystemEventConfig> = {
  profileUpdated: {
    icon: '👤',
    bgClass: 'bg-secondary/10',
    borderClass: 'border-secondary/30',
    textClass: 'text-secondary',
    requiredParam: 'name',
  },
  missedCall: {
    icon: '📞',
    bgClass: 'bg-danger/10',
    borderClass: 'border-danger/30',
    textClass: 'text-danger',
    requiredParam: 'name',
  },
  groupRenamed: {
    icon: '✏️',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    textClass: 'text-warning',
    requiredParam: 'name',
  },
  memberAdded: {
    icon: '👋',
    bgClass: 'bg-success/10',
    borderClass: 'border-success/30',
    textClass: 'text-success',
    requiredParam: 'count',
  },
  memberRemoved: {
    icon: '🚪',
    bgClass: 'bg-surface-200',
    borderClass: 'border-surface-100',
    textClass: 'text-text-secondary',
  },
  announcement: {
    icon: '📢',
    bgClass: 'bg-accent/10',
    borderClass: 'border-accent/30',
    textClass: 'text-accent',
    requiredParam: 'message',
  },
};

const DEFAULT_CONFIG: SystemEventConfig = {
  icon: '🔔',
  bgClass: 'bg-surface-200',
  borderClass: 'border-surface-100',
  textClass: 'text-text-secondary',
};

@Component({
  selector: 'app-chat-system-bubble',
  imports: [TranslatePipe],
  template: `
    <div
      class="my-2 flex max-w-full justify-center px-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        class="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-center text-xs font-medium break-words"
        [class]="config().bgClass + ' ' + config().borderClass + ' ' + config().textClass"
      >
        <span aria-hidden="true" class="shrink-0 text-xs leading-none">{{ config().icon }}</span>
        <span class="min-w-0">{{ i18nKey() | t: displayParams() }}</span>
      </span>
    </div>
  `,
})
export class ChatSystemBubbleComponent {
  eventType = input.required<string>();
  params = input<Record<string, unknown>>({});

  readonly normalizedEventType = computed(() => this.eventType().trim());

  readonly displayParams = computed<Record<string, string | number | boolean | null>>(() => {
    const result: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(this.params()).slice(0, MAX_SYSTEM_EVENT_PARAMS)) {
      if (key === 'type') continue;

      if (typeof value === 'string') {
        result[key] = value.slice(0, MAX_SYSTEM_EVENT_PARAM_LENGTH);
      } else if (
        value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      ) {
        result[key] = value;
      }
    }

    return result;
  });

  readonly hasRequiredParam = computed(() => {
    const config = EVENT_CONFIGS[this.normalizedEventType()];
    if (!config?.requiredParam) return Boolean(config);

    const value = this.displayParams()[config.requiredParam];
    if (config.requiredParam === 'count') {
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    }
    return typeof value === 'string' && value.trim().length > 0;
  });

  readonly i18nKey = computed(() => {
    const eventType = this.normalizedEventType();
    return this.hasRequiredParam() ? `system.${eventType}` : 'notifications.systemAlert';
  });

  readonly config = computed<SystemEventConfig>(
    () => EVENT_CONFIGS[this.normalizedEventType()] ?? DEFAULT_CONFIG,
  );
}
