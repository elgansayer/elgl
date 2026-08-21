import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, computed, signal, resource } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { EscrowService, EscrowTransaction } from '../../services/escrow.service';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';
import { AppPillComponent } from '../../components/primitives/pill/pill.component';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../../components/primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-escrow-detail',
  imports: [
    HlmButton,
    TranslatePipe,
    AppCardComponent,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppPillComponent,
    AppButtonPrimaryComponent,
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
          <h1 class="app-section-title">{{ 'escrow.detailTitle' | t }}</h1>
          <p class="app-muted">{{ 'escrow.detailSubtitle' | t }}</p>
        </div>
      </header>

      <!-- Loading Skeleton -->
      @if (loading()) {
        <div role="status" [attr.aria-label]="'common.loading' | t">
          <app-card>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <app-skeleton-loader height="24px" width="60%" />
                <app-skeleton-loader height="24px" width="80px" borderRadius="12px" />
              </div>
              <app-skeleton-loader height="32px" width="40%" borderRadius="8px" />
              <app-skeleton-loader height="16px" width="80%" />
              <div class="space-y-2 pt-2">
                <app-skeleton-loader height="14px" width="50%" />
                <app-skeleton-loader height="14px" width="70%" />
              </div>
              <div class="pt-3 flex gap-3">
                <app-skeleton-loader height="40px" width="120px" borderRadius="12px" />
                <app-skeleton-loader height="40px" width="120px" borderRadius="12px" />
              </div>
            </div>
          </app-card>
        </div>
      }

      <!-- Error State -->
      @if (!loading() && error()) {
        <app-card variant="outlined" customClass="border-danger/40 bg-danger/10">
          <div class="flex flex-col items-start gap-3">
            <p class="text-sm text-danger">{{ 'escrow.detailLoadError' | t }}</p>
            <app-button-secondary size="sm" (clicked)="reload()">
              {{ 'escrow.retry' | t }}
            </app-button-secondary>
          </div>
        </app-card>
      }

      <!-- Action Error -->
      @if (actionError()) {
        <div
          class="rounded-app border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          {{ actionError() }}
        </div>
      }

      <!-- Action Success -->
      @if (actionSuccess()) {
        <div
          class="rounded-app border border-success/40 bg-success/10 p-3 text-sm text-success"
          role="status"
        >
          {{ actionSuccess() }}
        </div>
      }

      <!-- Empty / Not Found -->
      @if (!loading() && !error() && !escrow()) {
        <app-empty-state
          icon="🔍"
          [title]="'escrow.notFoundTitle' | t"
          [description]="'escrow.notFoundDescription' | t"
          [actionLabel]="'escrow.backToList' | t"
          (actionClicked)="goBack()"
        />
      }

      <!-- Escrow Detail Content -->
      @if (!loading() && !error() && escrow(); as detail) {
        <app-card>
          <div class="space-y-4">
            <!-- Status Header -->
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-bold text-text-primary">
                {{ detail.description }}
              </h2>
              <app-pill
                [label]="'escrow.status.' + detail.status | t"
                [colour]="statusColour(detail.status)"
                size="sm"
              />
            </div>

            <!-- Amount -->
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold text-primary">{{ detail.amount }}</span>
              <span class="text-sm text-text-secondary">{{ 'escrow.coins' | t }}</span>
            </div>

            <!-- Details -->
            <div class="space-y-2 pt-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">{{
                  'escrow.detailId' | t
                }}</span>
                <span class="text-xs text-text-primary font-mono">{{ detail.id }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">{{
                  'escrow.detailServiceType' | t
                }}</span>
                <span class="text-xs text-text-primary">{{
                  'escrow.serviceType.' + detail.service_type | t
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">{{
                  'escrow.detailCreatedAt' | t
                }}</span>
                <span class="text-xs text-text-primary">{{ formatDate(detail.created_at) }}</span>
              </div>
              @if (detail.updated_at !== detail.created_at) {
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-text-secondary">{{
                    'escrow.detailUpdatedAt' | t
                  }}</span>
                  <span class="text-xs text-text-primary">{{ formatDate(detail.updated_at) }}</span>
                </div>
              }
            </div>

            <!-- Dispute Info -->
            @if (detail.dispute_reason) {
              <div class="rounded-app border border-danger/30 bg-danger/5 p-3">
                <p class="text-xs font-semibold text-danger mb-1">
                  {{ 'escrow.disputeReason' | t }}
                </p>
                <p class="text-xs text-danger/80">{{ detail.dispute_reason }}</p>
                @if (detail.dispute_evidence) {
                  <p class="text-xs text-text-secondary mt-1">
                    {{ 'escrow.disputeEvidence' | t }}: {{ detail.dispute_evidence }}
                  </p>
                }
              </div>
            }

            <!-- Admin Note -->
            @if (detail.admin_note) {
              <div class="rounded-app border border-warning/30 bg-warning/5 p-3">
                <p class="text-xs font-semibold text-warning mb-1">{{ 'escrow.adminNote' | t }}</p>
                <p class="text-xs text-warning/80">{{ detail.admin_note }}</p>
              </div>
            }

            <!-- Action Buttons -->
            @if (detail.status === 'pending' || detail.status === 'disputed') {
              <div class="flex flex-wrap gap-3 pt-2">
                @if (detail.status === 'pending') {
                  <app-button-primary [disabled]="isReleasing()" (clicked)="onRelease(detail.id)">
                    @if (isReleasing()) {
                      {{ 'escrow.releasing' | t }}
                    } @else {
                      {{ 'escrow.release' | t }}
                    }
                  </app-button-primary>

                  <app-button-secondary [disabled]="isRefunding()" (clicked)="onRefund(detail.id)">
                    @if (isRefunding()) {
                      {{ 'escrow.refunding' | t }}
                    } @else {
                      {{ 'escrow.refund' | t }}
                    }
                  </app-button-secondary>

                  <app-button-secondary
                    [disabled]="isDisputing()"
                    customClass="text-danger border-danger/40 hover:bg-danger/10"
                    (clicked)="onDispute(detail.id)"
                  >
                    @if (isDisputing()) {
                      {{ 'escrow.disputing' | t }}
                    } @else {
                      {{ 'escrow.dispute' | t }}
                    }
                  </app-button-secondary>
                }
              </div>
            }
          </div>
        </app-card>
      }
    </div>
  `,
})
export class EscrowDetailComponent {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly escrowService = inject(EscrowService);
  private readonly i18n = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly isReleasing = signal(false);
  protected readonly isRefunding = signal(false);
  protected readonly isDisputing = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);

  private readonly escrowId = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ?? '';
  });

  protected readonly escrowResource = resource({
    loader: async (): Promise<EscrowTransaction | null> => {
      const id = this.escrowId();
      if (!id) return null;
      this.loading.set(true);
      this.error.set(false);
      try {
        return (await this.escrowService.getEscrow(id)) ?? null;
      } catch {
        this.error.set(true);
        return null;
      } finally {
        this.loading.set(false);
      }
    },
  });

  protected readonly escrow = computed(() => this.escrowResource.value() ?? null);

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

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.currentLang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  protected async onRelease(id: string): Promise<void> {
    this.isReleasing.set(true);
    this.actionError.set(null);
    try {
      await this.escrowService.releaseEscrow(id);
      this.actionSuccess.set(this.i18n.translate('escrow.releaseSuccess'));
      this.escrowResource.reload();
    } catch {
      this.actionError.set(this.i18n.translate('escrow.actionError'));
    } finally {
      this.isReleasing.set(false);
    }
  }

  protected async onRefund(id: string): Promise<void> {
    this.isRefunding.set(true);
    this.actionError.set(null);
    try {
      await this.escrowService.refundEscrow(id);
      this.actionSuccess.set(this.i18n.translate('escrow.refundSuccess'));
      this.escrowResource.reload();
    } catch {
      this.actionError.set(this.i18n.translate('escrow.actionError'));
    } finally {
      this.isRefunding.set(false);
    }
  }

  protected async onDispute(id: string): Promise<void> {
    this.isDisputing.set(true);
    this.actionError.set(null);
    try {
      await this.escrowService.disputeEscrow(id, 'Dispute filed by user');
      this.actionSuccess.set(this.i18n.translate('escrow.disputeSuccess'));
      this.escrowResource.reload();
    } catch {
      this.actionError.set(this.i18n.translate('escrow.actionError'));
    } finally {
      this.isDisputing.set(false);
    }
  }

  protected reload(): void {
    this.escrowResource.reload();
  }

  protected goBack(): void {
    this.location.back();
  }
}
