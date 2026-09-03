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
  template: `
    <section class="profile-visitors" aria-labelledby="profile-visitors-title">
      <h2 id="profile-visitors-title" class="profile-visitors-title">
        {{ 'visitors.title' | t }}
      </h2>

      @if (isLoading() && visitors().length === 0) {
        <div class="profile-visitors-loading" role="status" aria-live="polite">
          <div class="visitor-spinner" aria-hidden="true"></div>
          <p>{{ 'visitors.loading' | t }}</p>
        </div>
      } @else if (error() && visitors().length === 0) {
        <div class="profile-visitors-error" role="alert">
          <p>{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (visitors().length === 0) {
        <div class="profile-visitors-empty">
          <p>{{ 'visitors.empty' | t }}</p>
        </div>
      } @else if (identityVisible()) {
        <div class="profile-visitors-list">
          @for (visit of visitors(); track visit.id) {
            <a [routerLink]="['/profile', visit.visitor.id]" class="profile-visitor-item">
              <div class="profile-visitor-avatar">
                @if (visit.visitor.avatar_url) {
                  <img [src]="visit.visitor.avatar_url" alt="" class="profile-visitor-avatar-img" />
                } @else {
                  <div class="profile-visitor-avatar-placeholder" aria-hidden="true">
                    {{ (visit.visitor.display_name || '?')[0] }}
                  </div>
                }
              </div>
              <div class="profile-visitor-info">
                <p class="profile-visitor-name">
                  {{ visit.visitor.display_name || ('common.unknownUser' | t) }}
                </p>
                <p class="profile-visitor-time">
                  {{ visit.created_at | date: 'medium' }}
                </p>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="profile-visitors-blurred">
          <div class="profile-visitors-placeholders" aria-hidden="true">
            @for (visit of visitors(); track visit.id) {
              <div class="profile-visitor-placeholder">
                <div class="profile-visitor-placeholder-avatar"></div>
                <div class="profile-visitor-placeholder-lines">
                  <div class="profile-visitor-placeholder-line w-24"></div>
                  <div class="profile-visitor-placeholder-line w-32"></div>
                </div>
              </div>
            }
          </div>

          <div class="profile-visitors-overlay">
            <div class="profile-visitors-overlay-content">
              <svg
                class="profile-visitors-lock-icon"
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
              <h3 class="profile-visitors-upgrade-title">
                {{ 'profile.upgradeTitle' | t }}
              </h3>
              <p class="profile-visitors-upgrade-price">
                {{ 'profile.upgradePrice' | t }}
              </p>
              <button
                hlmBtn
                type="button"
                class="profile-visitors-upgrade-btn"
                (click)="onUpgradeClick()"
              >
                {{ 'vip.seePlans' | t }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (error() && visitors().length > 0) {
        <div class="profile-visitors-inline-error" role="alert">
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
          class="profile-visitors-load-more"
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
  styles: [
    `
      :host {
        display: block;
      }
      .profile-visitors {
        padding: 1rem;
      }
      .profile-visitors-title {
        margin: 0 0 1rem;
        color: var(--color-text-primary, #e2e8f0);
        font-size: 1.25rem;
        font-weight: 700;
      }
      .profile-visitors-loading,
      .profile-visitors-error,
      .profile-visitors-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        min-height: 8rem;
        padding: 2rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.875rem;
      }
      .visitor-spinner {
        width: 2rem;
        height: 2rem;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--color-primary, #60a5fa);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .profile-visitors-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .profile-visitor-item,
      .profile-visitor-placeholder {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: 3.5rem;
        padding: 0.75rem;
        border: 1px solid var(--color-surface-border, rgba(255, 255, 255, 0.05));
        border-radius: 0.75rem;
        background: var(--color-surface-300, rgba(255, 255, 255, 0.035));
      }
      .profile-visitor-item {
        text-decoration: none;
        transition: background 0.2s;
      }
      .profile-visitor-item:hover,
      .profile-visitor-item:focus-visible {
        background: var(--color-surface-200, rgba(255, 255, 255, 0.05));
      }
      .profile-visitor-avatar,
      .profile-visitor-placeholder-avatar {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
      }
      .profile-visitor-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .profile-visitor-avatar-placeholder,
      .profile-visitor-placeholder-avatar,
      .profile-visitor-placeholder-line {
        background: var(--color-surface-100, rgba(255, 255, 255, 0.08));
      }
      .profile-visitor-avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-secondary, #94a3b8);
        font-size: 1.125rem;
      }
      .profile-visitor-info {
        flex: 1;
        min-width: 0;
      }
      .profile-visitor-name {
        margin: 0 0 0.125rem;
        color: var(--color-text-primary, #e2e8f0);
        font-size: 0.875rem;
        font-weight: 600;
      }
      .profile-visitor-time {
        margin: 0;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.75rem;
      }
      .profile-visitors-blurred {
        position: relative;
      }
      .profile-visitors-placeholders {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        filter: blur(6px);
        user-select: none;
        pointer-events: none;
      }
      .profile-visitor-placeholder-lines {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .profile-visitor-placeholder-line {
        height: 0.625rem;
        border-radius: 0.25rem;
      }
      .w-24 {
        width: 6rem;
      }
      .w-32 {
        width: 8rem;
      }
      .profile-visitors-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.75rem;
        background: rgba(18, 18, 18, 0.76);
      }
      .profile-visitors-overlay-content {
        max-width: 20rem;
        padding: 1.5rem;
        text-align: center;
      }
      .profile-visitors-lock-icon {
        display: block;
        width: 3rem;
        height: 3rem;
        margin: 0 auto 0.75rem;
        color: #f59e0b;
      }
      .profile-visitors-upgrade-title {
        margin: 0 0 0.25rem;
        color: var(--color-text-primary, #f1f5f9);
        font-size: 1rem;
        font-weight: 700;
      }
      .profile-visitors-upgrade-price {
        margin: 0 0 1rem;
        color: #fbbf24;
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .profile-visitors-upgrade-btn {
        min-height: 2.75rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        font-weight: 700;
      }
      .profile-visitors-inline-error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1rem;
        color: var(--color-danger, #ef4444);
      }
      .profile-visitors-inline-error p {
        margin: 0;
      }
      .profile-visitors-load-more {
        width: 100%;
        margin-top: 1rem;
      }
    `,
  ],
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

      this.identityVisible.set(page.identity_visible);
      this.visitors.update((current) => {
        const combined = reset ? page.items : [...current, ...page.items];
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
