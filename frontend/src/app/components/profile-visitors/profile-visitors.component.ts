import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { ProfileVisit } from '../../interfaces/profile-visit.interface';
import { AuthService } from '../../services/auth.service';
import { ProfileVisitsService } from '../../services/profile-visits.service';
import { TranslatePipe } from '../../services/translate.pipe';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-profile-visitors',
  imports: [HlmButton, DatePipe, RouterLink, TranslatePipe],
  host: { class: 'block' },
  template: `
    <section class="profile-visitors p-4" aria-labelledby="profile-visitors-title">
      <h2 id="profile-visitors-title" class="mb-4 text-xl font-bold text-text-primary">
        {{ 'visitors.title' | t }}
      </h2>

      @if (isLoading() && visitors().length === 0) {
        <div
          class="profile-visitors-loading flex min-h-32 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-text-secondary"
          role="status"
          aria-live="polite"
        >
          <div
            class="visitor-spinner size-8 animate-spin rounded-full border-2 border-surface-100 border-t-primary motion-reduce:animate-none"
            aria-hidden="true"
          ></div>
          <p>{{ 'visitors.loading' | t }}</p>
        </div>
      } @else if (error() && visitors().length === 0) {
        <div
          class="profile-visitors-error flex min-h-32 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-danger-ink"
          role="alert"
        >
          <p>{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (visitors().length === 0) {
        <div
          class="profile-visitors-empty flex min-h-32 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-text-secondary"
        >
          <p>{{ 'visitors.empty' | t }}</p>
        </div>
      } @else if (identityVisible()) {
        <div class="profile-visitors-list flex flex-col gap-2">
          @for (visit of visitors(); track visit.id) {
            <a
              [routerLink]="['/profile', visit.visitor.id]"
              class="profile-visitor-item flex min-h-14 items-center gap-3 rounded-card border border-surface-100 bg-surface-300 p-3 no-underline transition-colors hover:bg-surface-200 focus-visible:bg-surface-200 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              <div class="profile-visitor-avatar size-10 shrink-0 overflow-hidden rounded-full">
                @if (visit.visitor.avatar_url) {
                  <img
                    [src]="visit.visitor.avatar_url"
                    alt=""
                    loading="lazy"
                    class="profile-visitor-avatar-img size-full object-cover"
                  />
                } @else {
                  <div
                    class="profile-visitor-avatar-initial flex size-full items-center justify-center bg-surface-100 text-lg text-text-secondary"
                    aria-hidden="true"
                  >
                    {{ (visit.visitor.display_name || '?')[0] }}
                  </div>
                }
              </div>
              <div class="profile-visitor-info min-w-0 flex-1">
                <p class="profile-visitor-name mb-0.5 text-sm font-semibold text-text-primary">
                  {{ visit.visitor.display_name || ('common.unknownUser' | t) }}
                </p>
                <p class="profile-visitor-time text-xs text-text-secondary">
                  <time [attr.datetime]="visit.created_at">{{
                    visit.created_at | date: 'medium'
                  }}</time>
                </p>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="profile-visitors-blurred relative min-h-64">
          <div
            class="profile-visitors-masked-cards pointer-events-none flex select-none flex-col gap-2 blur-sm"
            aria-hidden="true"
          >
            @for (visit of visitors(); track visit.id) {
              <div
                class="profile-visitor-masked-card flex min-h-14 items-center gap-3 rounded-card border border-surface-100 bg-surface-300 p-3"
              >
                <div
                  class="profile-visitor-masked-card-avatar size-10 shrink-0 rounded-full bg-surface-100"
                ></div>
                <div class="profile-visitor-masked-card-lines flex flex-1 flex-col gap-1.5">
                  <div class="profile-visitor-masked-card-line h-2.5 w-24 rounded bg-surface-100"></div>
                  <div class="profile-visitor-masked-card-line h-2.5 w-32 rounded bg-surface-100"></div>
                </div>
              </div>
            }
          </div>

          <div
            class="profile-visitors-overlay absolute inset-0 flex items-center justify-center rounded-card bg-surface-500/80"
          >
            <div class="profile-visitors-overlay-content max-w-xs p-6 text-center">
              <svg
                class="profile-visitors-lock-icon mx-auto mb-3 block size-12 text-vip"
                width="48"
                height="48"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <h3 class="profile-visitors-upgrade-title mb-1 text-base font-bold text-text-primary">
                {{ 'profile.upgradeTitle' | t }}
              </h3>
              <p class="profile-visitors-upgrade-price mb-4 text-sm font-semibold text-text-secondary">
                {{ 'profile.upgradePrice' | t }}
              </p>
              <button
                hlmBtn
                type="button"
                size="touch"
                class="profile-visitors-upgrade-btn rounded-pill font-bold"
                (click)="onUpgradeClick()"
              >
                {{ 'vip.seePlans' | t }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (error() && visitors().length > 0) {
        <div
          class="profile-visitors-inline-error mt-4 flex items-center justify-between gap-4 text-danger-ink"
          role="alert"
        >
          <p>{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      }

      @if (hasMore() && !error()) {
        <button
          hlmBtn
          type="button"
          variant="secondary"
          size="touch"
          class="profile-visitors-load-more mt-4 w-full"
          [disabled]="isLoadingMore()"
          [attr.aria-busy]="isLoadingMore() ? 'true' : null"
          (click)="loadMore()"
        >
          @if (isLoadingMore()) {
            {{ 'visitors.loading' | t }}
          } @else {
            {{ 'events.load_more' | t }}
          }
        </button>
      }
    </section>
  `,
})
export class ProfileVisitorsComponent {
  private readonly profileVisitsService = inject(ProfileVisitsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private loadedOwnerId = '';
  private nextOffset: number | null = 0;
  private requestSequence = 0;
  private latestRequestId = 0;

  readonly visitors = signal<ProfileVisit[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly identityVisible = signal(false);
  readonly error = signal(false);
  readonly hasMore = signal(false);

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (!user) {
        this.loadedOwnerId = '';
        this.resetState();
        return;
      }

      if (this.loadedOwnerId === user.id) return;
      this.loadedOwnerId = user.id;
      void this.loadVisitors(true);
    });
  }

  retry(): void {
    void this.loadVisitors(this.visitors().length === 0);
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoadingMore() || this.nextOffset === null) return;
    void this.loadVisitors(false);
  }

  onUpgradeClick(): void {
    void this.router.navigate(['/subscription']);
  }

  private async loadVisitors(reset: boolean): Promise<void> {
    const offset = reset ? 0 : this.nextOffset;
    if (offset === null) return;

    const requestId = ++this.requestSequence;
    this.latestRequestId = requestId;
    this.error.set(false);

    if (reset) {
      this.isLoading.set(true);
      this.visitors.set([]);
      this.nextOffset = 0;
      this.hasMore.set(false);
    } else {
      this.isLoadingMore.set(true);
    }

    try {
      const page = await this.profileVisitsService.getMyVisitors(PAGE_SIZE, offset);
      if (requestId !== this.latestRequestId) return;

      // If the owner's entitlement changed between pages (for example VIP lapsing), rows loaded
      // under the previous state are discarded rather than mixed with the new presentation, so
      // identities never survive into a masked list and masked cards never receive profile links.
      const keepPrevious = !reset && this.identityVisible() === page.identity_visible;
      this.identityVisible.set(page.identity_visible);
      this.visitors.update((current) => {
        const combined = keepPrevious ? [...current, ...page.items] : page.items;
        return Array.from(new Map(combined.map((visit) => [visit.id, visit])).values());
      });
      this.hasMore.set(page.has_more);
      this.nextOffset = page.next_offset;
    } catch {
      if (requestId === this.latestRequestId) this.error.set(true);
    } finally {
      if (requestId === this.latestRequestId) {
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      }
    }
  }

  private resetState(): void {
    this.latestRequestId = ++this.requestSequence;
    this.visitors.set([]);
    this.isLoading.set(false);
    this.isLoadingMore.set(false);
    this.identityVisible.set(false);
    this.error.set(false);
    this.hasMore.set(false);
    this.nextOffset = 0;
  }
}
