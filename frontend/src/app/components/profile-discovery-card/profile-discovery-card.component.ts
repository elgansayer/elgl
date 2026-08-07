import { Component, computed, input } from '@angular/core';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-profile-discovery-card',
  imports: [SanitiseHtmlPipe, TranslatePipe],
  template: `
    <article
      class="bg-surface-400 rounded-xl overflow-hidden border border-surface-100 p-3 sm:p-4 transition hover:border-accent-500/50 active:scale-[0.98] touch-manipulation cursor-pointer"
    >
      <div class="flex items-center gap-3">
        <img
          [src]="profile().avatar_url || '/assets/default-avatar.png'"
          [alt]="profile().display_name || ('discovery.partnerFallback' | t)"
          class="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-accent-400/30 shrink-0"
          loading="lazy"
        />
        <div class="flex-1 min-w-0">
          <h3 class="text-text-primary font-semibold text-sm sm:text-base truncate">
            {{ profile().display_name | sanitiseHtml }}
          </h3>
          <p class="text-text-secondary text-xs sm:text-sm truncate">
            {{ (profile().native_languages?.join(', ') ?? '') | sanitiseHtml }}
            →
            {{ (profile().target_languages?.join(', ') ?? '') | sanitiseHtml }}
          </p>
        </div>
      </div>
      @if (truncatedBio(); as bio) {
        <p class="mt-2 text-text-secondary text-xs sm:text-sm line-clamp-2">{{ bio | sanitiseHtml }}</p>
      }
      <!-- Mobile-optimised tap area hint -->
      <div class="mt-3 flex items-center justify-between sm:hidden">
        <span class="text-[10px] text-text-muted">{{ 'discovery.tapToView' | t }}</span>
        <span class="text-accent-400 text-sm" aria-hidden="true">→</span>
      </div>
    </article>
  `,
})
export class ProfileDiscoveryCardComponent {
  readonly profile = input.required<UserProfile>();

  readonly truncatedBio = computed(() => {
    const bio = this.profile().bio_text;
    if (!bio) return null;
    return bio.length > 120 ? bio.slice(0, 120) + '...' : bio;
  });
}
