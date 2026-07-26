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
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 bg-black/60 z-40 transition-opacity"
        (click)="close()"
        aria-hidden="true"
      ></div>
    }

    <!-- Drawer Panel -->
    <div 
      class="fixed inset-y-0 end-0 z-50 w-80 bg-[#121212] border-s border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col"
      [class.translate-x-0]="isOpen()"
      [class.translate-x-full]="!isOpen()"
      [class.rtl:-translate-x-0]="isOpen()"
      [class.rtl:-translate-x-full]="!isOpen()"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 class="text-lg font-bold text-slate-100">
          {{ 'group.participants' | t: { count: participants().length } }}
        </h2>
        <button 
          (click)="close()"
          class="p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Close drawer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Participant List -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        @for (user of participants(); track user.id) {
          <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700">
            <!-- Avatar -->
            <div class="relative h-12 w-12 rounded-full overflow-hidden bg-slate-700 shrink-0">
              @if (user.avatar_url) {
                <img [src]="user.avatar_url" [alt]="user.display_name" class="object-cover w-full h-full" />
              } @else {
                <div class="flex items-center justify-center w-full h-full text-slate-300 font-bold text-lg">
                  {{ user.display_name.charAt(0).toUpperCase() }}
                </div>
              }
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-slate-200 truncate">{{ user.display_name }}</h3>
                @if (user.is_vip) {
                  <span class="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-900 bg-yellow-400 rounded-sm shrink-0">
                    {{ 'discovery.vipBadge' | t }}
                  </span>
                }
              </div>
              
              <!-- Language Exchange Pair -->
              <div class="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                <span class="font-medium text-slate-300">{{ user.native_language }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-500 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span class="font-medium text-emerald-400">{{ user.target_languages[0] || 'Any' }}</span>
              </div>
            </div>
          </div>
        } @empty {
          <div class="text-center py-8 text-slate-500 text-sm">
            {{ 'group.noParticipants' | t }}
          </div>
        }
      </div>
    </div>
  `
})
export class GroupParticipantDrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly participants = input<GroupParticipant[]>([]);

  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
