import { Component, inject, input, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface FullAchievementDto {
  code: string;
  name: string;
  description: string;
  current: number;
  required: number;
  earned: boolean;
}

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [],
  template: `
    <div class="ps-4 pe-4 py-3">
      @if (achievementsResource.isLoading()) {
        <div class="text-slate-400 text-sm">Loading...</div>
      } @else if (achievementsResource.error()) {
        <div class="text-red-400 text-sm">Error loading achievements.</div>
      } @else {
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (ach of achievementsResource.value(); track ach.code) {
            <div
              class="flex items-center gap-3 p-3 rounded-lg transition-colors duration-200"
              [class.bg-slate-800]="!ach.earned"
              [class.bg-green-900]="ach.earned"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate"
                   [class.text-slate-200]="!ach.earned"
                   [class.text-green-200]="ach.earned">
                  {{ ach.name }}
                </p>
                <p class="text-xs text-slate-400 truncate">{{ ach.description }}</p>
                <div class="mt-1 flex items-center gap-2">
                  <span class="text-xs text-slate-500">{{ ach.current }} / {{ ach.required }}</span>
                  @if (ach.earned) {
                    <span class="text-xs text-green-300">Earned</span>
                  }
                </div>
              </div>
              <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                   [class.bg-slate-700]="!ach.earned"
                   [class.bg-green-600]="ach.earned">
                @if (ach.earned) {
                  <span class="text-white">&#9733;</span>
                } @else {
                  <span class="text-slate-400">&#9723;</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AchievementsComponent {
  private readonly http = inject(HttpClient);

  readonly userId = input.required<string>();

  readonly achievementsResource = resource({
    request: () => ({ userId: this.userId() }),
    loader: ({ request }) => {
      return firstValueFrom(
        this.http.get<FullAchievementDto[]>(`/api/achievements/full/${request.userId}`)
      );
    },
  });
}
