import { Component, computed, inject, resource } from '@angular/core';
import { SupabaseService, UserProfile } from '../services/supabase.service';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
  selector: 'app-user-spotlight',
  imports: [TranslatePipe],
  template: `
    <section
      class="bg-surface rounded-xl p-4 space-y-2"
      role="region"
      aria-label="{{ 'spotlight.title' | t }}"
    >
      <h2 class="text-sm uppercase tracking-wider text-text-muted font-medium">
        {{ 'spotlight.title' | t }}
      </h2>
      <ul class="space-y-2">
        @for (user of users(); track user.id) {
          <li class="flex items-center gap-3">
            <img
              [src]="user.avatar_url"
              [alt]="user.display_name"
              width="40"
              height="40"
              loading="lazy"
              decoding="async"
              class="w-10 h-10 rounded-full"
            />
            <div>
              <p class="text-lg font-bold">{{ user.display_name }}</p>
              <p class="text-sm text-text-muted">{{ user.native_languages.join(', ') }}</p>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
})
export class UserSpotlightComponent {
  private readonly supabaseService = inject(SupabaseService);

  private readonly usersResource = resource<UserProfile[], unknown>({
    loader: () => this.supabaseService.getRecentlyJoinedNativeSpeakers(),
  });

  readonly users = computed<UserProfile[]>(() => this.usersResource.value() ?? []);
}
