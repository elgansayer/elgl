import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../services/i18n.service';
import { TranslatePipe } from '../../../services/translate.pipe';
import { getLanguageFlag } from '../../primitives/language-picker/language-picker.component';

export type ProfileLanguageKind = 'native' | 'target';

interface LanguageBadge {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
}

const HEADING_KEYS: Record<ProfileLanguageKind, string> = {
  native: 'profile.nativeLanguagesHeading',
  target: 'profile.targetLanguagesHeading',
};

const BADGE_BASE_CLASSES =
  'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-pill border ps-2.5 pe-3 pt-1 pb-1 text-sm font-medium';

// The heading text names the group, so the tone is a reinforcement and never the only cue.
const BADGE_TONE_CLASSES: Record<ProfileLanguageKind, string> = {
  native: 'border-surface-100 bg-surface-200 text-text-primary',
  target: 'border-primary/30 bg-primary/10 text-primary-ink',
};

function languageName(names: Intl.DisplayNames | null, code: string): string {
  try {
    return names?.of(code.replace(/_/g, '-')) ?? code.toUpperCase();
  } catch {
    // Profile languages are free text on the API, so a malformed tag must not break rendering.
    return code.toUpperCase();
  }
}

function primaryLanguageSubtag(code: string): string {
  return code.split(/[-_]/)[0];
}

/**
 * Read-only badges for the native or target languages on a profile.
 *
 * Names follow the interface language so the same profile reads naturally in every locale.
 * Language codes arrive as untrusted text: they are trimmed, de-duplicated and rendered through
 * Angular interpolation only.
 */
@Component({
  selector: 'app-profile-language-badges',
  imports: [TranslatePipe],
  template: `
    <div role="group" [attr.aria-labelledby]="headingId">
      <h3 [id]="headingId" class="text-xs font-semibold uppercase text-text-secondary">
        {{ headingKey() | t }}
      </h3>
      @if (badges().length > 0) {
        <ul class="mt-2 flex flex-wrap gap-2" role="list">
          @for (badge of badges(); track badge.code) {
            <li [class]="badgeClasses()" [attr.data-language-code]="badge.code">
              <span aria-hidden="true">{{ badge.flag }}</span>
              <span class="min-w-0 break-words">{{ badge.name }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="mt-2 text-sm text-text-secondary">{{ 'profile.languagesNotSet' | t }}</p>
      }
    </div>
  `,
})
export class ProfileLanguageBadgesComponent {
  private readonly i18n = inject(I18nService);

  readonly kind = input.required<ProfileLanguageKind>();
  readonly languages = input<readonly string[] | null | undefined>(null);

  protected readonly headingId = `profile-language-badges-${crypto.randomUUID()}`;
  protected readonly headingKey = computed(() => HEADING_KEYS[this.kind()]);
  protected readonly badgeClasses = computed(
    () => `${BADGE_BASE_CLASSES} ${BADGE_TONE_CLASSES[this.kind()]}`,
  );

  private readonly displayNames = computed(() => {
    try {
      return new Intl.DisplayNames([this.i18n.currentLang()], { type: 'language' });
    } catch {
      return null;
    }
  });

  protected readonly badges = computed<readonly LanguageBadge[]>(() => {
    const names = this.displayNames();
    const seen = new Set<string>();
    const badges: LanguageBadge[] = [];
    for (const raw of this.languages() ?? []) {
      if (typeof raw !== 'string') continue;
      const code = raw.trim();
      const identity = code.toLowerCase();
      if (!code || seen.has(identity)) continue;
      seen.add(identity);
      badges.push({
        code,
        name: languageName(names, code),
        flag: getLanguageFlag(primaryLanguageSubtag(code)),
      });
    }
    return badges;
  });
}
