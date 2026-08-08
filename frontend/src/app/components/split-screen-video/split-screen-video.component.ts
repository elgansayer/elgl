import { Component, input, computed, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-split-screen-video',
  imports: [TranslatePipe],
  template: `
    <div class="flex w-full h-full gap-2 sm:gap-3 flex-col md:flex-row" role="group" aria-label="Split screen video">
      <!-- Host Video -->
      <div class="relative flex-1 bg-black rounded-lg sm:rounded-xl overflow-hidden shadow-lg min-h-0" role="region" [attr.aria-label]="'splitScreen.hostVideoAria' | t">
        <video
          [src]="hostVideoUrl()"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover"
          [attr.aria-label]="'splitScreen.hostVideoAria' | t"
        ></video>
        <div
          class="absolute bottom-2 sm:bottom-4 start-2 sm:start-4 bg-black/60 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md"
          role="status"
        >
          {{ hostName() }} {{ 'splitScreen.hostBadge' | t }}
        </div>
      </div>

      <!-- Co-Host Video or Invite Placeholder -->
      @if (hasCoHost()) {
        <div class="relative flex-1 bg-black rounded-lg sm:rounded-xl overflow-hidden shadow-lg min-h-0" role="region" [attr.aria-label]="'splitScreen.coHostVideoAria' | t">
          <video
            [src]="coHostVideoUrl()"
            autoplay
            playsinline
            class="w-full h-full object-cover"
            [attr.aria-label]="'splitScreen.coHostVideoAria' | t"
          ></video>
          <div
            class="absolute bottom-2 sm:bottom-4 start-2 sm:start-4 bg-black/60 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md"
            role="status"
          >
            {{ coHostName() }} {{ 'splitScreen.coHostBadge' | t }}
          </div>
        </div>
      } @else {
        <div
          class="relative flex-1 bg-slate-900 rounded-lg sm:rounded-xl overflow-hidden shadow-lg border-2 border-dashed border-slate-700 flex items-center justify-center min-h-0"
        >
          <button
            (click)="onInviteClick()"
            class="flex flex-col items-center text-slate-400 hover:text-white transition-colors p-4 sm:p-6 rounded-xl hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
            [attr.aria-label]="'splitScreen.inviteCoHostAria' | t"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8 sm:h-12 sm:w-12 mb-2 sm:mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="text-sm sm:text-lg font-semibold">{{ 'splitScreen.inviteCoHostBtn' | t }}</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class SplitScreenVideoComponent {
  readonly hostVideoUrl = input<string>('');
  readonly coHostVideoUrl = input<string>('');
  readonly hostName = input<string>('Host');
  readonly coHostName = input<string>('Co-Host');

  readonly hasCoHost = computed(() => !!this.coHostVideoUrl());

  readonly invite = output<void>();

  onInviteClick(): void {
    this.invite.emit();
  }
}
