import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { filter } from 'rxjs';
import { ConfirmService } from '../../services/confirm.service';
import { EconomyStore } from '../../services/economy.store';
import {
  ConversationAnalysisResult,
  PremiumAiService,
  PremiumAiServiceCatalogItem,
} from '../../services/premium-ai.service';
import { TranslatePipe } from '../../services/translate.pipe';

const CHAT_ROOM_URL = /^\/chat\/([0-9a-f-]{36})(?:[/?#]|$)/i;

@Component({
  selector: 'app-conversation-analysis-launcher',
  imports: [CommonModule, HlmButton, TranslatePipe],
  template: `
    @if (roomId()) {
      <aside
        class="fixed bottom-[76px] end-3 z-40 flex max-h-[min(70dvh,36rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-sheet border border-surface-100 bg-surface-200 p-3 shadow-lift lg:bottom-4 lg:end-4"
        [attr.aria-label]="service()?.name ?? ('common.loading' | t)"
      >
        @if (result()) {
          <div class="min-w-0 overflow-y-auto" aria-live="polite">
            <div class="mb-2 flex items-start justify-between gap-2">
              <h2 class="min-w-0 text-sm font-bold text-text-primary">
                {{ service()?.name }}
              </h2>
              <button hlmBtn variant="ghost" type="button" (click)="closeResult()">
                {{ 'common.close' | t }}
              </button>
            </div>
            <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
              {{ result()?.report }}
            </p>
          </div>
        } @else if (catalogError()) {
          <div class="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
            <span class="text-sm text-danger">{{ 'common.error' | t }}</span>
            <button hlmBtn variant="outline" type="button" (click)="loadCatalog()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else if (service()) {
          <div class="min-w-0">
            <p class="break-words text-sm font-semibold text-text-primary">{{ service()?.name }}</p>
            <p class="mt-1 break-words text-xs leading-relaxed text-text-secondary">
              {{ service()?.description }}
            </p>
          </div>
          @if (runError()) {
            <p class="text-sm text-danger" role="status" aria-live="polite">
              {{ 'common.error' | t }}
            </p>
          }
          <button
            hlmBtn
            type="button"
            class="min-h-11 w-full whitespace-normal"
            [disabled]="running()"
            [attr.aria-busy]="running()"
            (click)="runAnalysis()"
          >
            @if (running()) {
              {{ 'common.loading' | t }}
            } @else if (runError()) {
              {{ 'common.retry' | t }} · 🪙 {{ service()?.cost_coins }}
            } @else {
              {{ service()?.name }} · 🪙 {{ service()?.cost_coins }}
            }
          </button>
        } @else {
          <div class="py-2 text-center text-sm text-text-secondary" aria-live="polite">
            {{ 'common.loading' | t }}
          </div>
        }
      </aside>
    }
  `,
})
export class ConversationAnalysisLauncherComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly premiumAi = inject(PremiumAiService);
  private readonly confirmService = inject(ConfirmService);
  private readonly economyStore = inject(EconomyStore);

  readonly roomId = signal<string | null>(this.roomIdFromUrl(this.router.url));
  readonly service = signal<PremiumAiServiceCatalogItem | null>(null);
  readonly result = signal<ConversationAnalysisResult | null>(null);
  readonly running = signal(false);
  readonly catalogError = signal(false);
  readonly runError = signal(false);

  private idempotencyKey: string | null = null;
  private catalogLoaded = false;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.handleNavigation(event.urlAfterRedirects));

    if (this.roomId()) void this.loadCatalog();
  }

  async loadCatalog(): Promise<void> {
    if (this.catalogLoaded && this.service()) return;
    this.catalogError.set(false);
    try {
      const services = await this.premiumAi.getServices();
      const analysis = services.find((item) => item.key === 'conversation_analysis_report') ?? null;
      this.service.set(analysis);
      this.catalogLoaded = analysis !== null;
      this.catalogError.set(analysis === null);
    } catch {
      this.catalogError.set(true);
    }
  }

  async runAnalysis(): Promise<void> {
    const roomId = this.roomId();
    const service = this.service();
    if (!roomId || !service || this.running()) return;

    const confirmed = await this.confirmService.confirm(
      `${service.name}\n${service.description}\n🪙 ${service.cost_coins}`,
    );
    if (!confirmed) return;

    this.runError.set(false);
    this.running.set(true);
    this.idempotencyKey ??= this.premiumAi.createIdempotencyKey();

    try {
      const result = await this.premiumAi.runConversationAnalysis(roomId, this.idempotencyKey);
      if (roomId !== this.roomId()) return;
      this.result.set(result);
      this.economyStore.coinsBalance.set(result.coins_remaining);
      this.idempotencyKey = null;
    } catch (error: unknown) {
      if (roomId !== this.roomId()) return;
      this.runError.set(true);
      // A received server error means the backend has a definite mutation
      // outcome. Unknown transport failures keep the same key so retry cannot
      // accidentally buy a second report.
      if (error instanceof HttpErrorResponse && error.status > 0 && error.status !== 409) {
        this.idempotencyKey = null;
      }
    } finally {
      if (roomId === this.roomId()) this.running.set(false);
    }
  }

  closeResult(): void {
    this.result.set(null);
    this.runError.set(false);
  }

  private handleNavigation(url: string): void {
    const nextRoomId = this.roomIdFromUrl(url);
    if (nextRoomId === this.roomId()) return;
    this.roomId.set(nextRoomId);
    this.result.set(null);
    this.runError.set(false);
    this.running.set(false);
    this.idempotencyKey = null;
    if (nextRoomId && !this.catalogLoaded) void this.loadCatalog();
  }

  private roomIdFromUrl(url: string): string | null {
    return CHAT_ROOM_URL.exec(url)?.[1] ?? null;
  }
}
