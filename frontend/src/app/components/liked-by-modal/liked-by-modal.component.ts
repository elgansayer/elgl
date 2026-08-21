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
        aria-labelledby="liked-by-title"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 id="liked-by-title" class="text-xl font-bold text-text-primary">{{ 'moments.likedBy' | t }}</h2>
          <button hlmBtn type="button" variant="ghost" size="icon-touch" [attr.aria-label]="'common.close' | t" (click)="closeModal.emit()">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        @if (likedUsers.isLoading()) {
          <div class="flex justify-center py-8">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" role="progressbar" [attr.aria-label]="'common.loading' | t"></div>
          </div>
        } @else if (likedUsers.error()) {
          <div class="py-6 text-center font-medium text-text-muted">{{ 'common.loadError' | t }}</div>
        } @else {
          <div class="max-h-96 overflow-y-auto pe-2">
            @if (likedUsers.value(); as users) {
              @for (user of users; track user.id) {
                <div class="mb-1 flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-100/50">
                  <img [src]="user.avatar_url || 'assets/default-avatar.png'" class="h-12 w-12 rounded-full border border-surface-100 object-cover" [alt]="user.display_name" />
                  <div>
                    <div class="font-bold text-text-primary">{{ user.display_name }}</div>
                    <div class="mt-0.5 text-xs font-medium text-text-secondary">
                      {{ user.native_languages?.[0] || '' | uppercase }} ➔ {{ user.target_languages[0] || '' | uppercase }}
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="py-6 text-center font-medium text-text-muted">{{ 'moments.noLikesYet' | t }}</div>
              }
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
  private readonly http = inject(HttpClient);
  readonly dialogState = computed<HlmDialogState>(() => this.open() ? 'open' : 'closed');
  readonly likedUsers = resource({
    params: () => this.momentId(),
    loader: ({ params: momentId }) => firstValueFrom(this.http.get<LikedUser[]>(`/api/moments/${momentId}/likes`)),
  });

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.open()) this.closeModal.emit();
  }
}
