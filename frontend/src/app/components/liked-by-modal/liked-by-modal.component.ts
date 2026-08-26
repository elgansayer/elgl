import { Component, input, output, inject, resource, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';

interface LikedUser {
  id: string;
  avatar_url: string | null;
  display_name: string;
  native_languages?: string[];
  target_languages: string[];
}

@Component({
  selector: 'app-liked-by-modal',
  imports: [TranslatePipe, UpperCasePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-md rounded-2xl border border-surface-100 bg-surface-200 p-6 shadow-2xl"
        [attr.aria-labelledby]="dialogTitleId"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 [id]="dialogTitleId" class="min-w-0 text-xl font-bold text-text-primary">
            {{ 'moments.likedBy' | t }}
          </h2>
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="icon-touch"
            data-testid="liked-by-close"
            [attr.aria-label]="'common.close' | t"
            (click)="closeModal.emit()"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        @if (likedUsers.isLoading()) {
          <div class="flex justify-center py-8">
            <div
              class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"
              role="progressbar"
              [attr.aria-label]="'common.loading' | t"
            ></div>
          </div>
        } @else if (likedUsers.error()) {
          <div role="alert" class="flex flex-col items-center gap-3 py-6 text-center">
            <p class="font-medium text-text-muted">{{ 'common.loadError' | t }}</p>
            <button
              hlmBtn
              type="button"
              variant="outline"
              size="touch"
              data-testid="liked-by-retry"
              (click)="likedUsers.reload()"
            >
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else {
          <div class="max-h-96 overflow-y-auto pe-2">
            @if (likedUsers.value(); as users) {
              <ul class="m-0 list-none p-0" aria-live="polite">
                @for (user of users; track user.id) {
                  <li class="mb-1 flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-100/50">
                    <img
                      [src]="user.avatar_url || 'assets/default-avatar.png'"
                      class="h-12 w-12 shrink-0 rounded-full border border-surface-100 object-cover"
                      alt=""
                    />
                    <div class="min-w-0">
                      <div class="break-words font-bold text-text-primary" dir="auto">
                        {{ user.display_name }}
                      </div>
                      <div class="mt-0.5 break-words text-xs font-medium text-text-secondary">
                        {{ user.native_languages?.[0] || '' | uppercase }} ➔
                        {{ user.target_languages[0] || '' | uppercase }}
                      </div>
                    </div>
                  </li>
                } @empty {
                  <li class="py-6 text-center font-medium text-text-muted">
                    {{ 'moments.noLikesYet' | t }}
                  </li>
                }
              </ul>
            }
          </div>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class LikedByModalComponent {
  readonly momentId = input.required<string>();
  readonly open = input(true);
  readonly closeModal = output<void>();
  readonly dialogTitleId = 'liked-by-title-' + crypto.randomUUID();
  private readonly http = inject(HttpClient);
  readonly dialogState = computed<HlmDialogState>(() => (this.open() ? 'open' : 'closed'));
  readonly likedUsers = resource({
    params: () => this.momentId(),
    loader: ({ params: momentId }) =>
      firstValueFrom(this.http.get<LikedUser[]>(`/api/moments/${momentId}/likes`)),
  });

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.open()) this.closeModal.emit();
  }
}
