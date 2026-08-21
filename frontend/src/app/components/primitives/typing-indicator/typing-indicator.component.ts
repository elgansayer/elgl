import { Component, input, computed } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';

export interface TypingUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-typing-indicator',
  imports: [TranslatePipe],
  template: `
    @if (visible()) {
      <div
        class="flex items-center gap-2 px-4 py-1.5 bg-surface-900/80 rounded-t-lg animate-slide-up"
        role="status"
        aria-live="polite"
        [attr.aria-label]="ariaLabel()"
      >
        @if (displayAvatars().length > 0) {
          <div class="flex -space-x-2">
            @for (user of displayAvatars(); track user.userId) {
              <img
                [src]="user.avatarUrl ?? '/assets/default-avatar.svg'"
                [alt]="user.displayName"
                class="w-5 h-5 rounded-full ring-2 ring-black/30 object-cover"
              />
            }
            @if (remainingCount() > 0) {
              <span
                class="w-5 h-5 rounded-full ring-2 ring-black/30 bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold"
              >
                +{{ remainingCount() }}
              </span>
            }
          </div>
        }
        <div class="flex items-center gap-1">
          <span class="flex items-center gap-1">
            <span
              class="typing-dot w-1.5 h-1.5 rounded-full bg-neon-violet opacity-40 animate-typing-bounce"
            ></span>
            <span
              class="typing-dot w-1.5 h-1.5 rounded-full bg-neon-violet opacity-40 animate-typing-bounce-delayed-1"
            ></span>
            <span
              class="typing-dot w-1.5 h-1.5 rounded-full bg-neon-violet opacity-40 animate-typing-bounce-delayed-2"
            ></span>
          </span>
          <span class="text-xs text-white/70 italic">{{ statusLabel() | t: statusParams() }}</span>
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
      :host {
        display: block;
      }
    `,
  ],
})
export class TypingIndicatorComponent {
  readonly typingUsers = input.required<TypingUser[]>();
  readonly maxVisible = input<number>(3);

  readonly visible = computed(() => this.typingUsers().length > 0);

  readonly displayAvatars = computed(() => this.typingUsers().slice(0, this.maxVisible()));

  readonly remainingCount = computed(() =>
    Math.max(0, this.typingUsers().length - this.maxVisible()),
  );

  readonly statusLabel = computed(() => {
    const count = this.typingUsers().length;
    if (count === 0) return '';
    if (count === 1) return 'typingIndicator.single';
    if (count <= this.maxVisible()) return 'typingIndicator.multiple';
    return 'typingIndicator.many';
  });

  readonly statusParams = computed(() => {
    const users = this.typingUsers();
    const count = users.length;
    if (count === 0) return {};
    if (count === 1) return { name: users[0].displayName };
    if (count <= this.maxVisible()) {
      const names = users.map((u) => u.displayName).join(', ');
      return { names };
    }
    const shown = users.slice(0, this.maxVisible());
    const names = shown.map((u) => u.displayName).join(', ');
    const remaining = count - this.maxVisible();
    return { names, count: remaining };
  });

  readonly ariaLabel = computed(() => {
    const count = this.typingUsers().length;
    if (count === 0) return '';
    if (count === 1) {
      return this.typingUsers()[0].displayName + ' is typing';
    }
    if (count > 4) return 'Several people are typing';
    return (
      this.typingUsers()
        .map((u) => u.displayName)
        .join(', ') + ' are typing'
    );
  });
}
