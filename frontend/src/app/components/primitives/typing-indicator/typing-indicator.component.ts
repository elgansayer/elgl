import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../services/i18n.service';

export interface TypingUser {
  userId: string;
  /** Empty when the name is unknown; the indicator shows a localised generic name. */
  displayName: string;
  /** Only ever set from trusted roster data, never from a realtime payload. */
  avatarUrl?: string;
}

@Component({
  selector: 'app-typing-indicator',
  template: `
    @if (visible()) {
      <div
        class="flex items-center gap-2 rounded-t-lg bg-surface-200 ps-4 pe-4 pt-1.5 pb-1.5 animate-slide-up"
        role="status"
        aria-live="polite"
        [attr.aria-label]="statusText()"
      >
        @if (displayAvatars().length > 0) {
          <div class="flex items-center">
            @for (user of displayAvatars(); track user.userId; let first = $first) {
              @if (user.avatarUrl) {
                <img
                  [src]="user.avatarUrl"
                  alt=""
                  class="size-5 rounded-full object-cover ring-2 ring-surface-200"
                  [class.-ms-2]="!first"
                />
              } @else {
                <span
                  class="flex size-5 items-center justify-center rounded-full bg-surface-100 text-[10px] font-bold text-text-primary ring-2 ring-surface-200"
                  [class.-ms-2]="!first"
                  aria-hidden="true"
                >
                  {{ initial(user) }}
                </span>
              }
            }
            @if (remainingCount() > 0) {
              <span
                class="-ms-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-fill ring-2 ring-surface-200"
                aria-hidden="true"
              >
                +{{ remainingCount() }}
              </span>
            }
          </div>
        }
        <div class="flex items-center gap-1">
          <span class="flex items-center gap-1" aria-hidden="true">
            <span
              class="typing-dot size-1.5 rounded-full bg-text-muted animate-typing-bounce"
            ></span>
            <span
              class="typing-dot size-1.5 rounded-full bg-text-muted animate-typing-bounce-delayed-1"
            ></span>
            <span
              class="typing-dot size-1.5 rounded-full bg-text-muted animate-typing-bounce-delayed-2"
            ></span>
          </span>
          <span class="text-xs italic text-text-secondary">{{ statusText() }}</span>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @keyframes typingBounce {
        0%,
        60%,
        100% {
          transform: translateY(0);
          opacity: 0.4;
        }
        30% {
          transform: translateY(-4px);
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-typing-bounce {
        animation: typingBounce 1.4s ease-in-out infinite;
      }
      .animate-typing-bounce-delayed-1 {
        animation: typingBounce 1.4s ease-in-out 0.2s infinite;
      }
      .animate-typing-bounce-delayed-2 {
        animation: typingBounce 1.4s ease-in-out 0.4s infinite;
      }
      .animate-slide-up {
        animation: slideUp 150ms ease-out;
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-typing-bounce,
        .animate-typing-bounce-delayed-1,
        .animate-typing-bounce-delayed-2,
        .animate-slide-up {
          animation: none;
        }
      }
      :host {
        display: block;
      }
    `,
  ],
})
export class TypingIndicatorComponent {
  private readonly i18n = inject(I18nService);

  readonly typingUsers = input.required<TypingUser[]>();
  readonly maxVisible = input<number>(3);

  readonly visible = computed(() => this.typingUsers().length > 0);

  readonly displayAvatars = computed(() => this.typingUsers().slice(0, this.maxVisible()));

  readonly remainingCount = computed(() =>
    Math.max(0, this.typingUsers().length - this.maxVisible()),
  );

  /**
   * The same sentence is shown visually and announced by screen readers, so the
   * meaning is never carried by the animated dots or the avatars alone.
   */
  readonly statusText = computed(() => {
    const users = this.typingUsers();
    const count = users.length;
    if (count === 0) return '';

    const names = users.slice(0, this.maxVisible()).map((user) => this.nameOf(user));
    const language = this.i18n.currentLang();

    if (count === 1) {
      return this.i18n.translate('typingIndicator.single', { name: names[0] });
    }
    if (count <= this.maxVisible()) {
      return this.i18n.translate('typingIndicator.multiple', {
        names: this.formatList(names, language, 'long'),
      });
    }
    return this.i18n.translate('typingIndicator.many', {
      names: this.formatList(names, language, 'narrow'),
      count: count - this.maxVisible(),
    });
  });

  initial(user: TypingUser): string {
    return Array.from(this.nameOf(user))[0]?.toLocaleUpperCase(this.i18n.currentLang()) ?? '';
  }

  private nameOf(user: TypingUser): string {
    return user.displayName.trim() || this.i18n.translate('typingIndicator.someone');
  }

  /**
   * Locale-aware list so separators and conjunctions follow the UI language.
   * `narrow` yields a bare separated list for the "and N others" variant.
   */
  private formatList(names: string[], language: string, style: 'long' | 'narrow'): string {
    try {
      return new Intl.ListFormat(language, { style, type: 'conjunction' }).format(names);
    } catch {
      return names.join(', ');
    }
  }
}
