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
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-400',
  },
  missedCall: {
    icon: '\ud83d\udcde',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-400',
  },
  groupRenamed: {
    icon: '\u270f\ufe0f',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-400',
  },
  memberAdded: {
    icon: '\ud83d\udc4b',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    textClass: 'text-emerald-400',
  },
  memberRemoved: {
    icon: '\ud83d\udeaa',
    bgClass: 'bg-slate-500/10',
    borderClass: 'border-slate-500/30',
    textClass: 'text-slate-400',
  },
  announcement: {
    icon: '\ud83d\udce2',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    textClass: 'text-purple-400',
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


