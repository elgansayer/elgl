import { Component, inject, signal, computed, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { UserService, ProfileVisitor } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-profile-visitors',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <div class="p-4">
      <h2 class="text-xl font-bold mb-4">Profile Visitors</h2>
      
      @if (isLoading()) {
        <div class="flex justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      } @else if (error()) {
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {{ error() }}
        </div>
      } @else if (isVip()) {
        <!-- VIP: Full access to visitor log -->
        <div class="space-y-3">
          @for (visit of visitors(); track visit.id) {
            <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors">
              <a [routerLink]="['/profile', visit.visitor_id]" class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden">
                  @if (visit.visitor?.avatar_url) {
                    <img [src]="visit.visitor?.avatar_url" alt="" class="w-full h-full object-cover" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-slate-400 text-lg">
                      {{ (visit.visitor?.display_name || '?')[0] }}
                    </div>
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium truncate">{{ visit.visitor?.display_name || 'Unknown User' }}</p>
                  <p class="text-sm text-slate-400">
                    {{ visit.created_at | date: 'medium' }}
                  </p>
                </div>
              </a>
              @if (visit.visitor?.native_language) {
                <span class="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300">
                  {{ visit.visitor.native_language | uppercase }}
                </span>
              }
            </div>
          } @empty {
            <div class="text-center py-8 text-slate-400">
              No visitors yet
            </div>
          }
        </div>
      } @else {
        <!-- Free user: Blurred preview with upgrade prompt -->
        <div class="relative">
          <div class="space-y-3 blur-sm pointer-events-none select-none">
            @for (placeholder of placeholderVisitors(); track $index) {
              <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div class="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0"></div>
                <div class="flex-1 space-y-1">
                  <div class="h-4 bg-slate-700 rounded w-24"></div>
                  <div class="h-3 bg-slate-700 rounded w-32"></div>
                </div>
              </div>
            }
          </div>
          
          <!-- Overlay with upgrade CTA -->
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 rounded-lg">
            <div class="text-center p-6 max-w-sm">
              <svg class="w-12 h-12 mx-auto mb-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <h3 class="text-lg font-bold mb-2">Upgrade to VIP</h3>
              <p class="text-sm text-slate-300 mb-4">
                See who's been visiting your profile. Upgrade to VIP for full access to visitor analytics.
              </p>
              <button 
                (click)="onUpgradeClick()"
                class="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-full hover:from-yellow-400 hover:to-orange-400 transition-all"
              >
                Upgrade Now - £8/month
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ProfileVisitorsComponent {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  readonly visitors = signal<ProfileVisitor[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isVip = signal(false);

  readonly placeholderVisitors = computed(() => {
    return Array.from({ length: 5 }, (_, i) => ({ id: `placeholder-${i}` }));
  });

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.isVip.set(user.is_vip || false);
        this.loadVisitors();
      }
    });
  }

  private async loadVisitors(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      const visitors = await this.userService.getProfileVisitors();
      this.visitors.set(visitors);
    } catch (err) {
      this.error.set('Failed to load visitors. Please try again.');
      console.error('Error loading visitors:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onUpgradeClick(): void {
    // Navigate to subscription/pricing page
    console.log('Upgrade clicked - navigate to pricing');
  }
}
