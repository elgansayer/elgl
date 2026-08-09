import { Component, computed, inject, input, signal } from '@angular/core';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserProfile } from '../../services/user.service';
import { DiscoveryService } from '../../services/discovery.service';

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
      @if (displayBio(); as bio) {
        <p class="mt-2 text-text-secondary text-xs sm:text-sm line-clamp-2">{{ bio | sanitiseHtml }}</p>
        @if (profile()?.bio_text) {
          <button
            type="button"
            class="mt-1 text-[10px] text-accent-400 hover:text-accent-300 transition-colors"
            (click)="toggleTranslation($event)"
          >
            {{ translationLabel() | t }}
          </button>
        }
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

  private readonly discoveryService = inject(DiscoveryService);
  private readonly i18n = inject(I18nService);

  readonly translatedBioText = signal<string>('');
  readonly showTranslated = signal<boolean>(false);
  readonly isTranslating = signal<boolean>(false);

  readonly truncatedBio = computed(() => {
    const bio = this.profile().bio_text;
    if (!bio) return null;
    return bio.length > 120 ? bio.slice(0, 120) + '...' : bio;
  });

  readonly displayBio = computed(() => {
    if (this.showTranslated() && this.translatedBioText()) {
      const translated = this.translatedBioText();
      return translated.length > 120 ? translated.slice(0, 120) + '...' : translated;
    }
    return this.truncatedBio();
  });

  readonly translationLabel = computed(() => {
    if (this.isTranslating()) return 'profile.translatingBio';
    return this.showTranslated() ? 'profile.showOriginal' : 'profile.translateBio';
  });

  async toggleTranslation(event: Event): Promise<void> {
    event.stopPropagation();
    if (this.isTranslating()) return;

    if (this.showTranslated()) {
      this.showTranslated.set(false);
      return;
    }

    if (this.translatedBioText()) {
      this.showTranslated.set(true);
      return;
    }

    this.isTranslating.set(true);
    try {
      const targetLang = this.i18n.currentLang() || 'en-GB';
      const translated = await this.discoveryService.translateBio(
        this.profile().id,
        targetLang,
      );
      if (translated) {
        this.translatedBioText.set(translated);
        this.showTranslated.set(true);
      }
    } finally {
      this.isTranslating.set(false);
    }
  }
}
