import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import type { LinkPreviewShare } from '../../services/chat.service';

@Component({
  selector: 'app-share-card',
  imports: [RouterLink, TranslatePipe],
  template: `
    <a
      [routerLink]="share().webUrl"
      [attr.aria-label]="'shareCard.openAria' | t: { title: title() }"
      class="mt-2 block min-w-0 overflow-hidden rounded-xl border border-surface-100 bg-surface-100 no-underline transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      @if (safeImage(); as img) {
        <div class="h-36 w-full overflow-hidden bg-surface-300">
          <img
            [src]="img"
            alt=""
            class="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          />
        </div>
      }
      <div class="min-w-0 ps-3 pe-3 pt-2.5 pb-2.5">
        <p
          class="mb-1 break-words text-[10px] font-semibold uppercase tracking-wide text-primary-ink/60"
        >
          {{ 'shareCard.badge' | t }} · {{ typeLabel() }}
        </p>
        <p
          dir="auto"
          class="line-clamp-2 break-words text-sm font-bold leading-snug text-text-primary"
        >
          {{ title() }}
        </p>
        @if (description()) {
          <p dir="auto" class="line-clamp-2 mt-1 break-words text-xs text-text-secondary">
            {{ description() }}
          </p>
        }
        @if (share().pricing; as price) {
          <p
            dir="ltr"
            class="mt-1.5 inline-block rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary-ink"
          >
            {{ price.display }}
          </p>
        }
      </div>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
})
export class ShareCardComponent {
  private readonly sanitisation = inject(HtmlSanitisationService);
  private readonly i18n = inject(I18nService);

  readonly share = input.required<LinkPreviewShare>();
  readonly title = input('');
  readonly description = input('');
  readonly image = input('');

  readonly typeLabel = computed(() =>
    this.i18n.translate(`shareCard.type.${this.share().entityType}`),
  );

  readonly safeImage = computed(() => {
    const sanitised = this.sanitisation.sanitiseUrl(this.image()).trim();
    if (!sanitised) return '';

    try {
      const parsed = new URL(sanitised);
      if (
        (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
        parsed.username.length > 0 ||
        parsed.password.length > 0
      ) {
        return '';
      }
      return parsed.href;
    } catch {
      return '';
    }
  });
}
