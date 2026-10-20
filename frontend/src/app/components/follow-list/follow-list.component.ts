import { Component, computed, inject, input, resource } from '@angular/core';
import { Location, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { UserQuickActionsComponent } from '../user-quick-actions/user-quick-actions.component';

@Component({
  selector: 'app-follow-list',
  imports: [
    RouterLink,
    UpperCasePipe,
    TranslatePipe,
    UserQuickActionsComponent,
    ...HlmButtonImports,
  ],
  template: `
    <div class="flex h-full flex-col overflow-y-auto bg-surface-500 text-text-primary">
      <div class="sticky top-0 z-10 flex items-center gap-4 border-b border-surface-100 bg-surface-500/90 p-4 backdrop-blur">
        <button hlmBtn type="button" variant="ghost" size="icon-touch" (click)="goBack()" [attr.aria-label]="'common.back' | t">
          <span class="text-xl" aria-hidden="true">←</span>
        </button>
        <h1 class="text-lg font-bold">{{ titleKey() | t }}</h1>
      </div>

      <div class="p-4" role="status" aria-live="polite">
        @if (listResource.isLoading()) {
          <div class="flex justify-center py-8"><div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true"></div></div>
        } @else if (listResource.error()) {
          <p class="error-message py-6 text-center font-medium text-neon-pink" role="alert">{{ loadErrorMessage() }}</p>
        } @else {
          <ul class="space-y-2" role="list">
            @for (user of users(); track user.id) {
              <li class="flex flex-wrap items-center gap-3 rounded-2xl border border-surface-100 bg-surface-300 p-3">
                <a [routerLink]="['/profile', user.id]" class="flex min-w-0 flex-1 items-center gap-3">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-100">
                    @if (user.avatar_url) {
                      <img [src]="user.avatar_url" alt="" class="h-full w-full object-cover" />
                    } @else {
                      <span class="text-lg font-bold text-text-secondary">{{ (user.display_name || '?').charAt(0) }}</span>
                    }
                  </div>
                  <div class="min-w-0">
                    <p class="truncate font-bold">{{ user.display_name || ('common.unknownUser' | t) }}</p>
                    @if (user.native_languages?.length || user.target_languages?.length) {
                      <p class="truncate text-xs text-text-secondary">
                        {{ (user.native_languages || []).join(', ') | uppercase }}
                        @if (user.target_languages?.length) { → {{ (user.target_languages || []).join(', ') | uppercase }} }
                      </p>
                    }
                  </div>
                </a>

                <app-user-quick-actions
                  class="ms-auto max-w-full shrink-0"
                  [userId]="user.id"
                  [displayName]="user.display_name || ('common.unknownUser' | t)"
                  [initiallyFollowing]="user.is_followed_by_me ?? false"
                />
              </li>
            } @empty {
              <p class="py-8 text-center text-text-secondary">{{ emptyKey() | t }}</p>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class FollowListComponent {
  private readonly userService = inject(UserService);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  readonly userId = input.required<string>();
  readonly mode = input<'followers' | 'following'>('followers');
  readonly titleKey = computed(() =>
    this.mode() === 'followers'
      ? 'followList.followersTitle'
      : 'followList.followingTitle',
  );
  readonly emptyKey = computed(() =>
    this.mode() === 'followers'
      ? 'followList.emptyFollowers'
      : 'followList.emptyFollowing',
  );

  readonly listResource = resource({
    params: () => ({ userId: this.userId(), mode: this.mode() }),
    loader: ({ params }) =>
      params.mode === 'followers'
        ? this.userService.getFollowers(params.userId)
        : this.userService.getFollowing(params.userId),
  });

  readonly loadErrorMessage = computed(() =>
    this.listResource.error()
      ? this.i18n.translate('followList.loadError')
      : '',
  );
  readonly users = computed<UserProfile[]>(
    () => this.listResource.value()?.data ?? [],
  );

  goBack(): void {
    this.location.back();
  }
}
