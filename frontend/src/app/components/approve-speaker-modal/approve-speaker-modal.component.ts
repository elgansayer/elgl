import { Component, input, output, inject, signal } from '@angular/core';
import { showToast } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { I18nService } from '../../services/i18n.service';

export interface RaisedHandRequest {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

@Component({
  selector: 'app-approve-speaker-modal',
  imports: [TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>{{ 'approveSpeakerModal.title' | t }}</span>
            </h3>
            <p class="text-xs text-text-secondary mt-1">
              {{ 'approveSpeakerModal.subtitle' | t: { count: requests().length } }}
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        @if (requests().length === 0) {
          <div class="app-empty-state py-8">
            <p class="text-sm text-text-secondary">
              {{ 'approveSpeakerModal.emptyState' | t }}
            </p>
          </div>
        } @else {
          <div class="space-y-3 max-h-80 overflow-y-auto">
            @for (req of requests(); track req.userId) {
              <div
                class="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-surface-300 p-4 gap-3"
                [class.opacity-50]="processedIds().has(req.userId)"
              >
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  @if (req.avatarUrl) {
                    <img
                      [src]="req.avatarUrl"
                      [alt]="req.displayName"
                      class="w-10 h-10 rounded-full object-cover border-2 border-amber-400 flex-shrink-0"
                    />
                  } @else {
                    <div
                      class="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-sm font-bold text-amber-300 flex-shrink-0"
                    >
                      {{ req.displayName.slice(0, 1).toUpperCase() }}
                    </div>
                  }
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-text-primary truncate">
                      {{ req.displayName }}
                    </p>
                    <p class="text-[10px] text-text-secondary">
                      {{ 'approveSpeakerModal.wantsStage' | t }}
                    </p>
                  </div>
                </div>
                <div class="flex gap-1.5 flex-shrink-0">
                  <button
                    (click)="dismissRequest(req.userId)"
                    [disabled]="processedIds().has(req.userId)"
                    class="rounded-app bg-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    {{ 'approveSpeakerModal.dismissBtn' | t }}
                  </button>
                  <button
                    (click)="approveRequest(req.userId)"
                    [disabled]="processedIds().has(req.userId)"
                    class="rounded-app bg-emerald-600 ps-3.5 pe-3.5 pt-1.5 pb-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-40"
                  >
                    {{ 'approveSpeakerModal.approveBtn' | t }}
                  </button>
                </div>
              </div>
            }
          </div>
        }

        @if (requests().length > 0) {
          <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
            <button
              (click)="closed.emit()"
              class="px-5 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs"
            >
              {{ 'approveSpeakerModal.doneBtn' | t }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out forwards;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
  ],
})
export class ApproveSpeakerModalComponent {
  requests = input.required<RaisedHandRequest[]>();
  closed = output<void>();

  private readonly store = inject(AudioRoomsStore);
  private readonly i18n = inject(I18nService);

  readonly processedIds = signal<Set<string>>(new Set());

  async approveRequest(userId: string): Promise<void> {
    this.processedIds.update((s) => {
      const next = new Set(s);
      next.add(userId);
      return next;
    });
    try {
      await this.store.approveSpeaker(userId);
      showToast(this.i18n.translate('audioRoom.speakerApprovedToast'));
    } catch {
      this.processedIds.update((s) => {
        const next = new Set(s);
        next.delete(userId);
        return next;
      });
      showToast(this.i18n.translate('common.error'));
    }
  }

  dismissRequest(userId: string): void {
    this.processedIds.update((s) => {
      const next = new Set(s);
      next.add(userId);
      return next;
    });
    void this.store.dismissRaisedHand(userId);
  }
}