import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, computed, signal, resource } from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowService, EscrowTransaction } from '../../services/escrow.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppPillComponent } from '../../components/primitives/pill/pill.component';
import { AppButtonSecondaryComponent } from '../../components/primitives/button-secondary/button-secondary.component';

const STATUS_FILTERS = ['all', 'pending', 'released', 'refunded', 'disputed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

@Component({
  selector: 'app-escrow',
  imports: [
    HlmButton,
    RouterLink,
    DatePipe,
    TranslatePipe,
    AppCardComponent,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppPillComponent,
    AppButtonSecondaryComponent,
  ],
  template: `
    <div class="app-screen app-padded pb-10">
      <header class="flex items-center gap-3 pt-2">
        <button
          hlmBtn
          type="button"
          (click)="goBack()"
          [attr.aria-label]="'common.back' | t"
          class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-100 text-text-primary hover:bg-surface-50"
        >
          <span aria-hidden="true">←</span>
        </button>
        <div>
          <h1 class="app-section-title">{{ 'escrow.title' | t }}</h1>
          <p class="app-muted">{{ 'escrow.subtitle' | t }}</p>
        </div>
        <button
          hlmBtn
          type="button"
          (click)="startOnboardingTour()"
          class="ms-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-fill hover:bg-primary/90 transition-colors text-sm font-bold"
          [attr.aria-label]="'escrow.onboarding.helpBtn' | t"
          [title]="'escrow.onboarding.helpBtn' | t"
        >
          ?
        </button>
      </header>

      <!-- Status Filter Pills -->
      <nav class="flex gap-2 overflow-x-auto py-3" aria-label="{{ 'escrow.filterLabel' | t }}">
        @for (f of statusFilters; track f) {
          <button
            hlmBtn
            type="button"
            class="whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
            [class.bg-primary]="selectedStatus() === f"
            [class.text-on-fill]="selectedStatus() === f"
            [class.bg-surface-100]="selectedStatus() !== f"
            [class.text-text-secondary]="selectedStatus() !== f"
            [class.hover:bg-surface-50]="selectedStatus() !== f"
            (click)="onFilterChange(f)"
            [attr.aria-pressed]="selectedStatus() === f"
          >
            {{ 'escrow.status.' + f | t }}
            @if (f === 'all') {
              ({{ totalCount() }})
            } @else {
              ({{ getStatusCount(f) }})
            }
          </button>
        }
      </nav>

      <!-- Loading Skeleton -->
      @if (loading()) {
        <div class="space-y-3" role="status" [attr.aria-label]="'common.loading' | t">
          @for (i of skeletonRows(); track i) {
            <app-card padding="none">
              <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <app-skeleton-loader height="16px" width="40%" borderRadius="4px" />
                  <app-skeleton-loader height="20px" width="70px" borderRadius="12px" />
                </div>
                <app-skeleton-loader height="14px" width="60%" borderRadius="4px" />
                <div class="flex items-center justify-between">
                  <app-skeleton-loader height="18px" width="80px" borderRadius="4px" />
                  <app-skeleton-loader height="14px" width="100px" borderRadius="4px" />
                </div>
              </div>
            </app-card>
          }
        </div>
      }

      <!-- Error State -->
      @if (!loading() && error()) {
        <app-card variant="outlined" customClass="border-danger/40 bg-danger/10">
          <div class="flex flex-col items-start gap-3">
            <p class="text-sm text-danger">{{ 'escrow.loadError' | t }}</p>
            <app-button-secondary size="sm" (clicked)="reload()">
              {{ 'escrow.retry' | t }}
            </app-button-secondary>
          </div>
        </app-card>
      }

      <!-- Empty State -->
      @if (!loading() && !error() && filteredEscrows().length === 0) {
        @if (selectedStatus() === 'all') {
          <app-empty-state
            icon="💱"
            [title]="'escrow.emptyTitle' | t"
            [description]="'escrow.emptyDescription' | t"
          />
        } @else {
          <app-empty-state
            icon="🔍"
            [title]="
              'escrow.emptyFilteredTitle' | t: { status: 'escrow.status.' + selectedStatus() | t }
            "
            [description]="'escrow.emptyFilteredDescription' | t"
            [actionLabel]="'escrow.showAll' | t"
            (actionClicked)="onFilterChange('all')"
          />
        }
      }

      <!-- Escrow List -->
      @if (!loading() && !error() && filteredEscrows().length > 0) {
        <div class="space-y-3">
          @for (escrow of filteredEscrows(); track escrow.id) {
            <a
              [routerLink]="['/escrow', escrow.id]"
              class="block transition-opacity hover:opacity-80"
            >
              <app-card padding="none">
                <div class="p-4 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-text-primary">
                      {{ escrow.description }}
                    </span>
                    <app-pill
                      [label]="'escrow.status.' + escrow.status | t"
                      [colour]="statusColour(escrow.status)"
                      size="sm"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                      <span class="text-lg font-bold text-primary">
                        {{ escrow.amount }}
                      </span>
                      <span class="text-xs text-text-secondary">{{ 'escrow.coins' | t }}</span>
                    </div>
                    <span class="text-xs text-text-secondary">
                      {{ escrow.created_at | date: 'mediumDate' }}
                    </span>
                  </div>
                  <p class="text-xs text-text-secondary truncate">
                    {{ 'escrow.serviceType.' + escrow.service_type | t }}
                  </p>
                </div>
              </app-card>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class EscrowComponent {
  private readonly location = inject(Location);
  private readonly escrowService = inject(EscrowService);
  private readonly escrowOnboarding = inject(EscrowOnboardingService);

  protected readonly statusFilters: StatusFilter[] = [...STATUS_FILTERS];
  protected readonly selectedStatus = signal<StatusFilter>('all');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly skeletonRows = signal([1, 2, 3, 4]);

  private readonly escrowsResource = resource({
    loader: async (): Promise<EscrowTransaction[]> => {
      this.loading.set(true);
      this.error.set(false);
      try {
        const data = await this.escrowService.listEscrows();
        return data;
      } catch {
        this.error.set(true);
        return [];
      } finally {
        this.loading.set(false);
      }
    },
  });

  protected readonly allEscrows = computed(() => this.escrowsResource.value() ?? []);

  protected readonly filteredEscrows = computed(() => {
    const status = this.selectedStatus();
    const all = this.allEscrows();
    if (status === 'all') return all;
    return all.filter((e) => e.status === status);
  });

  protected readonly totalCount = computed(() => this.allEscrows().length);

  protected readonly countsByStatus = computed(() => {
    const statusCounts: Record<string, number> = {};
    for (const escrow of this.allEscrows()) {
      statusCounts[escrow.status] = (statusCounts[escrow.status] ?? 0) + 1;
    }
    return statusCounts;
  });

  protected getStatusCount(status: string): number {
    return this.countsByStatus()[status] ?? 0;
  }

  protected statusColour(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
    switch (status) {
      case 'released':
        return 'success';
      case 'pending':
        return 'info';
      case 'disputed':
        return 'danger';
      case 'refunded':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  startOnboardingTour(): void {
    this.escrowOnboarding.startTour();
  }

  onFilterChange(status: StatusFilter): void {
    this.selectedStatus.set(status);
  }

  protected reload(): void {
    this.escrowsResource.reload();
  }

  protected goBack(): void {
    this.location.back();
  }
}
