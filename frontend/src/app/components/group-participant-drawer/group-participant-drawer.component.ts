import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';

export interface GroupParticipant {
  id: string;
  display_name: string;
  avatar_url?: string;
  native_language: string;
  target_languages: string[];
  is_vip: boolean;
}

@Component({
  selector: 'app-group-participant-drawer',
  imports: [HlmButton, CommonModule, TranslatePipe],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40 bg-black/60 transition-opacity"
        (click)="close()"
        role="presentation"
      ></div>

      <!-- Drawer Panel -->
      <div
        class="fixed top-0 bottom-0 end-0 z-50 w-80 max-w-full bg-surface-300 shadow-2xl flex flex-col border-s border-surface-100 transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'group.participants' | t"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-surface-100">
          <h2 class="text-lg font-bold text-text-primary">
            {{ 'group.participants' | t }} ({{ participants().length }})
          </h2>
          <button
            hlmBtn
            (click)="close()"
            class="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            [attr.aria-label]="'common.close' | t"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Participant List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @for (user of participants(); track user.id) {
            <div
              class="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 hover:bg-surface-200/80 transition-colors border border-transparent hover:border-surface-100"
            >
              <!-- Avatar -->
              <div class="relative h-12 w-12 rounded-full overflow-hidden bg-surface-100 shrink-0">
                @if (user.avatar_url) {
                  <img
                    [src]="user.avatar_url"
                    [alt]="user.display_name"
                    class="object-cover w-full h-full"
                  />
                } @else {
                  <div
                    class="flex items-center justify-center w-full h-full text-text-secondary font-bold text-lg"
                  >
                    {{ user.display_name.charAt(0).toUpperCase() }}
                  </div>
                }
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 text-start">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-text-primary truncate">
                    {{ user.display_name }}
                  </h3>
                  @if (user.is_vip) {
                    <span
                      class="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-fill bg-vip rounded-sm shrink-0"
                    >
                      {{ 'discovery.vipBadge' | t }}
                    </span>
                  }
                </div>

                <!-- Language Exchange Pair -->
                <div class="flex items-center gap-1.5 mt-1 text-xs text-text-secondary">
                  <span class="font-medium text-text-secondary">{{ user.native_language }}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                  <span class="font-medium text-secondary">{{
                    user.target_languages[0] || ''
                  }}</span>
                </div>
              </div>
            </div>
          } @empty {
            <div class="text-center py-8 text-text-muted text-sm">
              {{ 'group.noParticipants' | t }}
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class GroupParticipantDrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly participants = input<GroupParticipant[]>([]);

  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
