import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Location, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-follow-list',
  imports: [RouterLink, UpperCasePipe, TranslatePipe],
  template: `
    <div class="h-full flex flex-col bg-surface-500 text-text-primary overflow-y-auto">
      <div
        class="sticky top-0 z-10 bg-surface-500/90 backdrop-blur border-b border-surface-100 p-4 flex items-center gap-4"
      >
        <button
          type="button"
          (click)="goBack()"
          [attr.aria-label]="'common.back' | t"
          class="p-2 -ms-2 rounded-full hover:bg-surface-300 transition-colors"
        >
          <span class="text-xl" aria-hidden="true">←</span>
        </button>
        <h1 class="text-lg font-bold">{{ titleKey() | t }}</h1>
      </div>

      <div class="p-4" role="status" aria-live="polite">
        @if (listResource.isLoading()) {
          <div class="flex justify-center py-8">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
              aria-hidden="true"
            ></div>
          </div>
        } @else if (listResource.error()) {
          <p class="text-center text-neon-pink py-6 font-medium" role="alert">
            {{ 'followList.loadError' | t }}
          </p>
        } @else {
          <ul class="space-y-2" role="list">
            @for (user of users(); track user.id) {
              <li
                class="flex items-center gap-3 p-3 bg-surface-300 rounded-2xl border border-surface-100"
              >
                <a
                  [routerLink]="['/profile', user.id]"
                  class="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div
                    class="h-12 w-12 rounded-full bg-surface-100 flex items-center justify-center overflow-hidden flex-shrink-0"
                  >
                    @if (user.avatar_url) {
                      <img [src]="user.avatar_url" alt="" class="h-full w-full object-cover" />
                    } @else {
                      <span class="text-lg font-bold text-text-secondary">{{
                        (user.display_name || '?').charAt(0)
                      }}</span>
                    }
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold truncate">
                      {{ user.display_name || ('common.unknownUser' | t) }}
                    </p>
                    @if (user.native_languages?.length || user.target_languages?.length) {
                      <p class="text-xs text-text-secondary truncate">
                        {{ (user.native_languages || []).join(', ') | uppercase }}
                        @if (user.target_languages?.length) {
                          → {{ (user.target_languages || []).join(', ') | uppercase }}
                        }
                      </p>
                    }
                  </div>
                </a>

                @if (canToggleFollow(user)) {
                  <button
                    type="button"
                    (click)="toggleFollow(user)"
                    [disabled]="isPending(user.id)"
                    class="h-9 px-4 rounded-full text-sm font-bold transition-colors flex-shrink-0"
                    [class.bg-neon-blue]="!user.is_followed_by_me"
                    [class.text-white]="!user.is_followed_by_me"
                    [class.bg-surface-100]="user.is_followed_by_me"
                    [class.text-text-primary]="user.is_followed_by_me"
                  >
                    {{ (user.is_followed_by_me ? 'followList.unfollow' : 'followList.follow') | t }}
                  </button>
                }
              </li>
            } @empty {
              <p class="text-center text-text-secondary py-8">{{ emptyKey() | t }}</p>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class FollowListComponent {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  readonly userId = input.required<string>();
  readonly mode = input<'followers' | 'following'>('followers');

  private readonly followOverrides = signal<Map<string, boolean>>(new Map());
  private readonly pendingIds = signal<Set<string>>(new Set());

  readonly titleKey = computed(() =>
    this.mode() === 'followers' ? 'followList.followersTitle' : 'followList.followingTitle',
  );

  readonly emptyKey = computed(() =>
    this.mode() === 'followers' ? 'followList.emptyFollowers' : 'followList.emptyFollowing',
  );

  readonly listResource = resource({
    params: () => ({ userId: this.userId(), mode: this.mode() }),
    loader: ({ params }) =>
      params.mode === 'followers'
        ? this.userService.getFollowers(params.userId)
        : this.userService.getFollowing(params.userId),
  });

  readonly users = computed<UserProfile[]>(() => {
    const list = this.listResource.value()?.data ?? [];
    const overrides = this.followOverrides();
    return list.map((user) =>
      overrides.has(user.id) ? { ...user, is_followed_by_me: overrides.get(user.id) } : user,
    );
  });

  goBack(): void {
    this.location.back();
  }

  canToggleFollow(user: UserProfile): boolean {
    return user.id !== this.authService.currentUser()?.id;
  }

  isPending(userId: string): boolean {
    return this.pendingIds().has(userId);
  }

  async toggleFollow(user: UserProfile): Promise<void> {
    if (this.isPending(user.id)) return;

    const wasFollowing = user.is_followed_by_me ?? false;
    this.pendingIds.update((ids) => new Set(ids).add(user.id));
    this.followOverrides.update((map) => new Map(map).set(user.id, !wasFollowing));

    try {
      if (wasFollowing) {
        await this.userService.unfollowUser(user.id);
      } else {
        await this.userService.followUser(user.id);
      }
    } catch (e: unknown) {
      this.followOverrides.update((map) => new Map(map).set(user.id, wasFollowing));
      console.error(this.i18n.translate('followList.loadError'), e);
    } finally {
      this.pendingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(user.id);
        return next;
      });
    }
  }
}
