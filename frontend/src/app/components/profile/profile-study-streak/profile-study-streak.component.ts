import { Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFlame } from '@ng-icons/lucide';
import { I18nService } from '../../../services/i18n.service';
import { TranslatePipe } from '../../../services/translate.pipe';

const STREAK_DAYS_KEY = 'profile.studyStreakDays';

function formatCount(count: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(count);
  } catch {
    return String(count);
  }
}

function pluralCategory(count: number, locale: string): Intl.LDMLPluralRule {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    return 'other';
  }
}

/**
 * Display-only study streak for the profile summary.
 *
 * The value comes from the authoritative profile payload and is never mutated here. The count and
 * its unit are one translated, plural-aware sentence so the unit follows the interface language,
 * and the flame is decorative: the streak is always available as text.
 */
@Component({
  selector: 'app-profile-study-streak',
  imports: [NgIcon, TranslatePipe],
  providers: [provideIcons({ lucideFlame })],
  template: `
    <div role="group" [attr.aria-labelledby]="headingId">
      <h3 [id]="headingId" class="text-xs font-semibold uppercase text-text-secondary">
        {{ 'profile.studyStreakHeading' | t }}
      </h3>
      <p class="mt-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <ng-icon
          name="lucideFlame"
          class="text-xl"
          [class.text-primary-ink]="hasStreak()"
          [class.text-text-muted]="!hasStreak()"
          aria-hidden="true"
        />
        <span data-testid="study-streak-value">{{ streakLabel() }}</span>
      </p>
      @if (!hasStreak()) {
        <p class="mt-1 text-xs text-text-secondary">{{ 'profile.studyStreakStart' | t }}</p>
      }
    </div>
  `,
})
export class ProfileStudyStreakComponent {
  private readonly i18n = inject(I18nService);

  /** Consecutive study days. Absent, negative or non-numeric values read as no streak. */
  readonly days = input<number | null | undefined>(0);

  protected readonly headingId = `profile-study-streak-${crypto.randomUUID()}`;

  protected readonly wholeDays = computed(() => {
    const days = this.days();
    return typeof days === 'number' && Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  });

  protected readonly hasStreak = computed(() => this.wholeDays() > 0);

  protected readonly streakLabel = computed(() => {
    const locale = this.i18n.currentLang();
    const count = this.wholeDays();
    const params = { count: formatCount(count, locale) };
    const categoryKey = `${STREAK_DAYS_KEY}.${pluralCategory(count, locale)}`;
    const translated = this.i18n.translate(categoryKey, params);
    // Locales can need categories (few, many, two) the dictionary does not define yet; "other" always exists.
    return translated === categoryKey
      ? this.i18n.translate(`${STREAK_DAYS_KEY}.other`, params)
      : translated;
  });
}
