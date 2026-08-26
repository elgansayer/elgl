import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import {
  HlmDialogImports,
  type HlmDialogState,
} from '@spartan-ng/helm/dialog';
import { MomentsStore } from '../../services/moments.store';
import type { MomentLikeUser } from '../../services/moments.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-liked-by-modal',
  imports: [
    TranslatePipe,
    UpperCasePipe,
    RouterLink,
    ...HlmButtonImports,
    ...HlmDialogImports,
  ],
  template: `
    <hlm-dialog
      [state]="dialogState()"
      (stateChanged)="onDialogStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[min(42rem,90dvh)] w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-sheet border border-surface-100 bg-surface-200 p-4 shadow-lift sm:p-6"
        aria-labelledby="liked-by-title"
        aria-describedby="liked-by-status"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 id="liked-by-title" class="text-xl font-bold text-text-primary">
            {{ 'moments.likedBy' | t }}
          </h2>
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="icon-touch"
            [attr.aria-label]="'common.close' | t"
            (click)="closeModal.emit()"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div id="liked-by-status" class="sr-only" aria-live="polite">
          @if (isLoading()) {
            {{ 'common.loading' | t }}
          } @else if (loadError()) {
            {{ 'common.loadError' | t }}
          } @else {
            {{ users().length }} {{ 'moments.likedBy' | t }}
          }
        </div>

        @if (isLoading()) {
          <div class="flex justify-center py-10" role="status">
            <div
              class="h-8 w-8 animate-spin rounded-full border-2 border-surface-100 border-b-primary"
              aria-hidden="true"
            ></div>
            <span class="sr-only">{{ 'common.loading' | t }}</span>
          </div>
        } @else if (loadError() && users().length === 0) {
          <div class="space-y-4 py-8 text-center">
            <p class="font-medium text-text-muted">
              {{ 'common.loadError' | t }}
            </p>
            <button hlmBtn type="button" variant="outline" (click)="retry()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else {
          <div class="max-h-[60dvh] overflow-y-auto pe-1 sm:pe-2">
            <div role="list" class="space-y-1">
              @for (user of users(); track user.id) {
                <a
                  role="listitem"
                  [routerLink]="['/profile/user', user.id]"
                  (click)="closeModal.emit()"
                  class="flex min-h-16 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <img
                    [src]="user.avatar_url || 'assets/default-avatar.png'"
                    class="h-12 w-12 shrink-0 rounded-full border border-surface-100 object-cover"
                    alt=""
                  />
                  <div class="min-w-0">
                    <div class="truncate font-bold text-text-primary">
                      {{ user.display_name }}
                    </div>
                    @if (hasLanguagePair(user)) {
                      <div class="mt-0.5 text-xs font-medium text-text-secondary">
                        {{ user.native_languages?.[0] || '' | uppercase }}
                        <span aria-hidden="true"> → </span>
                        {{ user.target_languages[0] || '' | uppercase }}
                      </div>
                    }
                  </div>
                </a>
              } @empty {
                <div class="py-8 text-center font-medium text-text-muted">
                  {{ 'moments.noLikesYet' | t }}
                </div>
              }
            </div>

            @if (loadError() && users().length > 0) {
              <div class="mt-4 space-y-3 text-center" role="status">
                <p class="text-sm text-text-muted">{{ 'common.loadError' | t }}</p>
                <button hlmBtn type="button" variant="outline" (click)="loadMore()">
                  {{ 'common.retry' | t }}
                </button>
              </div>
            } @else if (hasMore() && users().length > 0) {
              <div class="mt-4 flex justify-center">
                <button
                  hlmBtn
                  type="button"
                  variant="outline"
                  [disabled]="isLoadingMore()"
                  (click)="loadMore()"
                >
                  @if (isLoadingMore()) {
                    {{ 'common.loading' | t }}
                  } @else {
                    {{ 'events.load_more' | t }}
                  }
                </button>
              </div>
            }
          </div>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class LikedByModalComponent {
  private static readonly PAGE_SIZE = 50;

  readonly momentId = input.required<string>();
  readonly open = input(true);
  readonly closeModal = output<void>();

  private readonly momentsStore = inject(MomentsStore);
  private requestVersion = 0;

  readonly users = signal<MomentLikeUser[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal(false);
  readonly hasMore = signal(false);
  readonly dialogState = computed<HlmDialogState>(() =>
    this.open() ? 'open' : 'closed',
  );

  private readonly loadEffect = effect(() => {
    const momentId = this.momentId();
    const open = this.open();
    if (!open) {
      this.requestVersion += 1;
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
      return;
    }
    void this.loadFirstPage(momentId);
  });

  hasLanguagePair(user: MomentLikeUser): boolean {
    return Boolean(user.native_languages?.[0] && user.target_languages?.[0]);
  }

  retry(): void {
    void this.loadFirstPage(this.momentId());
  }

  async loadMore(): Promise<void> {
    if (this.isLoading() || this.isLoadingMore()) return;
    await this.loadPage(this.momentId(), this.users().length, true);
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.open()) this.closeModal.emit();
  }

  private async loadFirstPage(momentId: string): Promise<void> {
    this.requestVersion += 1;
    const version = this.requestVersion;
    this.users.set([]);
    this.hasMore.set(false);
    this.loadError.set(false);
    this.isLoadingMore.set(false);
    this.isLoading.set(true);

    try {
      const page = await this.momentsStore.loadMomentLikes(
        momentId,
        0,
        LikedByModalComponent.PAGE_SIZE,
      );
      if (version !== this.requestVersion || momentId !== this.momentId()) return;
      this.users.set(this.dedupe(page));
      this.hasMore.set(page.length === LikedByModalComponent.PAGE_SIZE);
    } catch {
      if (version !== this.requestVersion || momentId !== this.momentId()) return;
      this.loadError.set(true);
    } finally {
      if (version === this.requestVersion && momentId === this.momentId()) {
        this.isLoading.set(false);
      }
    }
  }

  private async loadPage(
    momentId: string,
    offset: number,
    append: boolean,
  ): Promise<void> {
    const version = this.requestVersion;
    this.loadError.set(false);
    this.isLoadingMore.set(true);

    try {
      const page = await this.momentsStore.loadMomentLikes(
        momentId,
        offset,
        LikedByModalComponent.PAGE_SIZE,
      );
      if (version !== this.requestVersion || momentId !== this.momentId()) return;

      const next = append ? [...this.users(), ...page] : page;
      this.users.set(this.dedupe(next));
      this.hasMore.set(page.length === LikedByModalComponent.PAGE_SIZE);
    } catch {
      if (version !== this.requestVersion || momentId !== this.momentId()) return;
      this.loadError.set(true);
    } finally {
      if (version === this.requestVersion && momentId === this.momentId()) {
        this.isLoadingMore.set(false);
      }
    }
  }

  private dedupe(users: MomentLikeUser[]): MomentLikeUser[] {
    const seen = new Set<string>();
    return users.filter((user) => {
      if (!user?.id || seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
  }
}
