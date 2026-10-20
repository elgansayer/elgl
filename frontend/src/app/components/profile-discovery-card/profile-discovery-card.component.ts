import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserProfile } from '../../services/user.service';
import { DiscoveryService } from '../../services/discovery.service';

@Component({
  selector: 'app-profile-discovery-card',
  imports: [HlmButton, SanitiseHtmlPipe, TranslatePipe],
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
            {{ profile().native_languages?.join(', ') ?? '' | sanitiseHtml }}
            →
            {{ profile().target_languages?.join(', ') ?? '' | sanitiseHtml }}
          </p>
        </div>
      </div>
      @if (displayBio(); as bio) {
        <p
          [id]="translationBioId()"
          class="mt-2 text-text-secondary text-xs sm:text-sm line-clamp-2"
          dir="auto"
          aria-live="polite"
          [attr.aria-atomic]="showTranslated() ? 'true' : null"
        >
          {{ bio | sanitiseHtml }}
        </p>
        <button
          hlmBtn
          type="button"
          class="mt-1 -ms-2 min-h-11 px-2 text-xs text-accent-400 hover:text-accent-300 transition-colors"
          [disabled]="isTranslating()"
          [attr.aria-busy]="isTranslating() ? 'true' : null"
          [attr.aria-pressed]="showTranslated()"
          [attr.aria-controls]="translationBioId()"
          [attr.aria-label]="translationActionLabel()"
          [attr.aria-describedby]="translationErrorKey() ? translationStatusId() : null"
          (click)="toggleTranslation($event)"
        >
          {{ translationLabel() | t }}
        </button>
        @if (translationErrorKey()) {
          <p
            [id]="translationStatusId()"
            class="mt-1 text-xs text-danger"
            role="status"
            aria-live="polite"
          >
            {{ translationErrorKey() | t }}
          </p>
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
  private translationContextKey = '';

  readonly translatedBioText = signal<string>('');
  readonly showTranslated = signal<boolean>(false);
  readonly isTranslating = signal<boolean>(false);
  readonly translationErrorKey = signal<string>('');

  readonly truncatedBio = computed(() => {
    const bio = this.profile().bio_text;
    if (!bio?.trim()) return null;
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

  readonly translationActionLabel = computed(() => {
    const action = this.i18n.translate(this.translationLabel());
    const displayName = this.profile().display_name?.trim();
    return displayName ? `${action}: ${displayName}` : action;
  });

  readonly translationContext = computed(() => {
    const targetLang = this.i18n.currentLang() || 'en-GB';
    return `${this.profile().id}\u0000${targetLang}\u0000${this.profile().bio_text ?? ''}`;
  });

  readonly translationBioId = computed(() => `profile-bio-${this.profile().id}`);

  readonly translationStatusId = computed(
    () => `profile-bio-translation-status-${this.profile().id}`,
  );

  constructor() {
    effect(() => {
      const context = this.translationContext();
      if (context === this.translationContextKey) return;

      this.translationContextKey = context;
      this.translatedBioText.set('');
      this.showTranslated.set(false);
      this.isTranslating.set(false);
      this.translationErrorKey.set('');
    });
  }

  async toggleTranslation(event: Event): Promise<void> {
    event.stopPropagation();
    if (this.isTranslating() || !this.profile().bio_text?.trim()) return;

    if (this.showTranslated()) {
      this.showTranslated.set(false);
      return;
    }

    if (this.translatedBioText()) {
      this.showTranslated.set(true);
      return;
    }

    const context = this.translationContext();
    const targetLang = this.i18n.currentLang() || 'en-GB';
    const profileId = this.profile().id;

    this.translationErrorKey.set('');
    this.isTranslating.set(true);
    try {
      const translated = await this.discoveryService.translateBio(profileId, targetLang);
      if (context !== this.translationContext()) return;

      if (translated) {
        this.translatedBioText.set(translated);
        this.showTranslated.set(true);
      } else {
        this.translationErrorKey.set('common.error_generic');
      }
    } catch {
      if (context === this.translationContext()) {
        this.translationErrorKey.set('common.error_generic');
      }
    } finally {
      if (context === this.translationContext()) {
        this.isTranslating.set(false);
      }
    }
  }
}
