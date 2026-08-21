import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { UserService, ProfileVisitor } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { RouterLink, Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-profile-visitors',
  imports: [HlmButton, DatePipe, RouterLink, TranslatePipe],
  template: `
    <div class="profile-visitors">
      <h2 class="profile-visitors-title">{{ 'visitors.title' | t }}</h2>

      @if (isLoading()) {
        <div class="profile-visitors-loading">
          <div class="visitor-spinner" aria-hidden="true"></div>
          <p>{{ 'visitors.loading' | t }}</p>
        </div>
      } @else if (isVip()) {
        <div class="profile-visitors-list">
          @for (visit of visitors(); track visit.id) {
            <a [routerLink]="['/profile', visit.visitor_id]" class="profile-visitor-item">
              <div class="profile-visitor-avatar">
                @if (visit.visitor?.avatar_url) {
                  <img
                    [src]="visit.visitor?.avatar_url"
                    alt=""
                    class="profile-visitor-avatar-img"
                  />
                } @else {
                  <div class="profile-visitor-avatar-placeholder">
                    {{ (visit.visitor?.display_name || '?')[0] }}
                  </div>
                }
              </div>
              <div class="profile-visitor-info">
                <p class="profile-visitor-name">
                  {{ visit.visitor?.display_name || ('common.unknownUser' | t) }}
                </p>
                <p class="profile-visitor-time">
                  {{ visit.created_at | date: 'medium' }}
                </p>
              </div>
            </a>
          } @empty {
            <div class="profile-visitors-empty">
              <p>{{ 'visitors.empty' | t }}</p>
            </div>
          }
        </div>
      } @else {
        <div class="profile-visitors-blurred">
          <div class="profile-visitors-placeholders">
            @for (placeholder of placeholderVisitors(); track $index) {
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
    </div>
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
        font-size: 1.25rem;
        font-weight: 700;
        color: #e2e8f0;
        margin: 0 0 1rem;
      }
      .profile-visitors-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        gap: 0.75rem;
        color: #64748b;
        font-size: 0.875rem;
      }
      .visitor-spinner {
        width: 2rem;
        height: 2rem;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: #60a5fa;
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
      .profile-visitor-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.05);
        text-decoration: none;
        transition: background 0.2s;
      }
      .profile-visitor-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .profile-visitor-avatar {
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
      .profile-visitor-avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        font-size: 1.125rem;
      }
      .profile-visitor-info {
        flex: 1;
        min-width: 0;
      }
      .profile-visitor-name {
        font-size: 0.875rem;
        font-weight: 600;
        color: #e2e8f0;
        margin: 0 0 0.125rem;
      }
      .profile-visitor-time {
        font-size: 0.75rem;
        color: #64748b;
        margin: 0;
      }
      .profile-visitors-empty {
        text-align: center;
        padding: 2rem;
        color: #64748b;
      }
      .profile-visitors-blurred {
        position: relative;
      }
      .profile-visitors-placeholders {
        filter: blur(6px);
        user-select: none;
        pointer-events: none;
      }
      .profile-visitor-placeholder {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .profile-visitor-placeholder-avatar {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }
      .profile-visitor-placeholder-lines {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .profile-visitor-placeholder-line {
        height: 0.625rem;
        background: rgba(255, 255, 255, 0.06);
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
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(18, 18, 18, 0.7);
        border-radius: 0.75rem;
      }
      .profile-visitors-overlay-content {
        text-align: center;
        padding: 1.5rem;
        max-width: 20rem;
      }
      .profile-visitors-lock-icon {
        width: 3rem;
        height: 3rem;
        margin: 0 auto 0.75rem;
        color: #f59e0b;
        display: block;
      }
      .profile-visitors-upgrade-title {
        font-size: 1rem;
        font-weight: 700;
        color: #f1f5f9;
        margin: 0 0 0.25rem;
      }
      .profile-visitors-upgrade-price {
        font-size: 0.8125rem;
        color: #fbbf24;
        font-weight: 600;
        margin: 0 0 1rem;
      }
      .profile-visitors-upgrade-btn {
        padding: 0.5rem 1.5rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        font-weight: 700;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #1c1917;
        border: none;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .profile-visitors-upgrade-btn:hover {
        opacity: 0.9;
      }
    `,
  ],
})
export class ProfileVisitorsComponent {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly visitors = signal<ProfileVisitor[]>([]);
  readonly isLoading = signal(true);
  readonly isVip = signal(false);

  readonly placeholderVisitors = computed(() =>
    Array.from({ length: 5 }, (_, i) => ({ id: `placeholder-${i}` })),
  );

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.isVip.set(user.is_vip || false);
        this.loadVisitors();
      }
    });
  }

  private async loadVisitors(): Promise<void> {
    try {
      this.isLoading.set(true);
      const visitors = await this.userService.getProfileVisitors();
      this.visitors.set(visitors);
    } catch {
      // Data fallback handled by mock-data in the service
    } finally {
      this.isLoading.set(false);
    }
  }

  onUpgradeClick(): void {
    this.router.navigate(['/vip']);
  }
}
