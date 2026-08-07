import { Component, computed, input } from '@angular/core';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { UserProfile } from '../../services/user.service';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';

@Component({
  selector: 'app-profile-discovery-card',
  imports: [SanitiseHtmlPipe],
  template: `
    <div class="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 p-4 transition hover:border-blue-500/50">
      <div class="flex items-center gap-3">
        <img
          [src]="profile().avatar_url || '/assets/default-avatar.png'"
          [alt]="profile().display_name"
          class="w-12 h-12 rounded-full object-cover ring-2 ring-blue-400/30"
         loading="lazy" />
        <div class="flex-1 min-w-0">
          <h3 class="text-white font-semibold text-base truncate">{{ profile().display_name | sanitiseHtml }}</h3>
          <p class="text-gray-400 text-sm truncate">
            {{ (profile().native_languages?.join(', ') ?? '') | sanitiseHtml }} → {{ (profile().target_languages?.join(', ') ?? '') | sanitiseHtml }}
          </p>
        </div>
      </div>
      @if (truncatedBio(); as bio) {
        <p class="mt-2 text-gray-300 text-sm line-clamp-2">{{ bio | sanitiseHtml }}</p>
      }
    </div>
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
