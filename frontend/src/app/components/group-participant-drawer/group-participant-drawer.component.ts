import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { GroupMember } from '../../services/chat.service';

@Component({
  selector: 'app-group-participant-drawer',
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/60 z-40 transition-opacity"
        (click)="closed.emit()"
        (keydown.escape)="closed.emit()"
      ></div>
    }

    <div
      class="fixed inset-y-0 end-0 z-50 w-80 bg-[#121212] border-s border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col"
      [class.translate-x-0]="isOpen()"
      [class.translate-x-full]="!isOpen()"
      role="dialog"
      [attr.aria-label]="'group.participants' | t: { count: participants().length }"
      [attr.aria-hidden]="!isOpen()"
    >
      <div class="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 class="text-lg font-bold text-slate-100 text-start">
          {{ 'group.participants' | t: { count: participants().length } }}
        </h2>
        <button
          (click)="closed.emit()"
          class="p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
          [attr.aria-label]="'common.close' | t"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
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

      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        @for (user of participants(); track user.user_id) {
          <div
            class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700"
          >
            <div class="relative h-12 w-12 rounded-full overflow-hidden bg-slate-700 shrink-0">
              @if (user.user?.avatar_url) {
                <img
                  [src]="user.user.avatar_url"
                  [alt]="user.user.display_name || ''"
                  class="object-cover w-full h-full"
                />
              } @else {
                <div
                  class="flex items-center justify-center w-full h-full text-slate-300 font-bold text-lg"
                >
                  {{ (user.user?.display_name || '?').charAt(0).toUpperCase() }}
                </div>
              }
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-slate-200 truncate">{{ user.user?.display_name || ('common.unknownUser' | t) }}</h3>
              <p class="text-xs text-slate-500 mt-0.5 truncate">{{ user.user?.id || '' }}</p>
            </div>
          </div>
        } @empty {
          <div class="text-center py-8 text-slate-500 text-sm">
            {{ 'group.noParticipants' | t }}
          </div>
        }
      </div>
    </div>
  `,
})
export class GroupParticipantDrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly participants = input<GroupMember[]>([]);
  readonly closed = output<void>();
}
