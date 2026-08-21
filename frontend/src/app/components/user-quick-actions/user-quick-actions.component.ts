import { Component, computed, inject, input } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserQuickActionsService } from '../../services/user-quick-actions.service';

@Component({
  selector: 'app-user-quick-actions',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    @if (!isSelf()) {
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <button
          hlmBtn
          type="button"
          variant="secondary"
          size="sm"
          (click)="openMessage($event)"
          [disabled]="actions.isMessagePending(userId())"
          [attr.aria-busy]="actions.isMessagePending(userId()) ? 'true' : null"
          [attr.aria-label]="('chatList.tapToChat' | t) + (displayName() ? ': ' + displayName() : '')"
        >
          {{ 'chatList.tapToChat' | t }}
        </button>

        <button
          hlmBtn
          type="button"
          variant="secondary"
          size="sm"
          (click)="toggleFollow($event)"
          [disabled]="actions.isFollowPending(userId())"
          [attr.aria-busy]="actions.isFollowPending(userId()) ? 'true' : null"
          [attr.aria-pressed]="actions.isFollowing(userId(), initiallyFollowing())"
          [attr.aria-label]="
            ((actions.isFollowing(userId(), initiallyFollowing())
              ? 'followList.unfollow'
              : 'followList.follow') | t) + (displayName() ? ': ' + displayName() : '')
          "
        >
          {{
            (actions.isFollowing(userId(), initiallyFollowing())
              ? 'followList.unfollow'
              : 'followList.follow') | t
          }}
        </button>
      </div>

      @if (actions.errorKey(userId()); as errorKey) {
        <p
          class="error-message mt-1 text-end text-xs text-danger"
          role="status"
          aria-live="polite"
        >
          {{ errorKey | t }}
        </p>
      }
    }
  `,
})
export class UserQuickActionsComponent {
  readonly userId = input.required<string>();
  readonly displayName = input<string>('');
  readonly initiallyFollowing = input<boolean>(false);

  readonly actions = inject(UserQuickActionsService);
  private readonly authService = inject(AuthService);

  readonly isSelf = computed(
    () => this.authService.currentUser()?.id === this.userId(),
  );

  openMessage(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.actions.openMessage(this.userId());
  }

  toggleFollow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.actions.toggleFollow(this.userId(), this.initiallyFollowing());
  }
}
