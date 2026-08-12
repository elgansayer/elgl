import { Component, input, output, inject, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
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
  imports: [TranslatePipe, UpperCasePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      (click)="closeModal.emit()"
      (keydown)="closeModal.emit()"
      tabindex="0"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="liked-by-title"
        class="bg-surface-200 border border-surface-100 w-full max-w-md rounded-2xl p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
        (keydown.escape)="closeModal.emit()"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 id="liked-by-title" class="text-xl font-bold text-text-primary">
            {{ 'moments.likedBy' | t }}
          </h2>
          <button
            class="text-text-secondary hover:text-text-primary transition-colours"
            [attr.aria-label]="'common.close' | t"
            (click)="closeModal.emit()"
          >
            ✕
          </button>
        </div>

        @if (likedUsers.isLoading()) {
          <div class="flex justify-center py-8">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
              role="progressbar"
              aria-label="Loading"
            ></div>
          </div>
        } @else if (likedUsers.error()) {
          <div class="text-center text-text-muted py-6 font-medium">
            {{ 'common.loadError' | t }}
          </div>
        } @else {
          <div class="max-h-96 overflow-y-auto pe-2">
            @if (likedUsers.value(); as users) {
              @for (user of users; track user.id) {
                <div
                  class="flex items-center gap-3 p-3 hover:bg-surface-100/50 rounded-xl transition-colours cursor-pointer mb-1"
                >
                  <img
                    [src]="user.avatar_url || 'assets/default-avatar.png'"
                    class="w-12 h-12 rounded-full object-cover border border-surface-100"
                    [alt]="user.display_name"
                  />
                  <div>
                    <div class="font-bold text-text-primary">{{ user.display_name }}</div>
                    <div class="text-xs font-medium text-text-secondary mt-0.5">
                      {{ user.native_languages?.[0] || '' | uppercase }} ➔
                      {{ user.target_languages[0] || '' | uppercase }}
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="text-center text-text-muted py-6 font-medium">
                  {{ 'moments.noLikesYet' | t }}
                </div>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class LikedByModalComponent {
  momentId = input.required<string>();
  closeModal = output<void>();

  private http = inject(HttpClient);

  readonly likedUsers = resource({
    params: () => this.momentId(),
    loader: ({ params: momentId }) =>
      firstValueFrom(this.http.get<LikedUser[]>(`/api/moments/${momentId}/likes`)),
  });
}
