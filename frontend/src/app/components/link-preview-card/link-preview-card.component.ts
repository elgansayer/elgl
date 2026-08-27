import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';

interface SafePreviewUrl {
  href: string;
  hostname: string;
  displayAddress: string;
}

const LINK_PREVIEW_LIMITS = {
  title: 300,
  description: 1000,
  siteName: 200,
} satisfies Record<string, number>;

@Component({
  selector: 'app-link-preview-card',
  imports: [CommonModule],
  template: `
    @if (safeDestination(); as destination) {
      <a
        [href]="destination.href"
        target="_blank"
        rel="noopener noreferrer"
        referrerpolicy="no-referrer"
        class="mt-2 block min-w-0 overflow-hidden rounded-xl border border-surface-100 bg-surface-100 no-underline transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        @if (displayImage(); as img) {
          <div class="h-36 w-full overflow-hidden bg-surface-300">
            <img
              [src]="img"
              alt=""
              class="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              (error)="onImageError()"
            />
          </div>
        }
        <div class="min-w-0 ps-3 pe-3 pt-2.5 pb-2.5">
          @if (displaySiteName()) {
            <p
              dir="auto"
              class="mb-1 break-words text-[10px] font-semibold uppercase tracking-wide text-primary/60"
            >
              {{ displaySiteName() }}
            </p>
          }
          @if (displayTitle()) {
            <p
              dir="auto"
              class="line-clamp-2 break-words text-sm font-bold leading-snug text-text-primary"
            >
              {{ displayTitle() }}
            </p>
          }
          @if (displayDescription()) {
            <p dir="auto" class="line-clamp-2 mt-1 break-words text-xs text-text-secondary">
              {{ displayDescription() }}
            </p>
          }
          <p dir="ltr" class="mt-1.5 truncate text-[10px] text-text-muted">
            {{ destination.displayAddress }}
          </p>
        </div>
      </a>
    }
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
export class LinkPreviewCardComponent {
  private readonly sanitisation = inject(HtmlSanitisationService);
  private readonly failedImageUrl = signal('');

  url = input<string>('');
  title = input('');
  description = input('');
  image = input('');
  siteName = input('');

  readonly safeDestination = computed(() => this.normaliseHttpUrl(this.url()));
  readonly sanitisedUrl = computed(() => this.safeDestination()?.href ?? '');
  readonly sanitisedImage = computed(() => this.normaliseHttpUrl(this.image())?.href ?? '');
  readonly displayImage = computed(() => {
    const image = this.sanitisedImage();
    return image && image !== this.failedImageUrl() ? image : '';
  });
  readonly displayTitle = computed(() =>
    this.normaliseText(this.title(), LINK_PREVIEW_LIMITS.title),
  );
  readonly displayDescription = computed(() =>
    this.normaliseText(this.description(), LINK_PREVIEW_LIMITS.description),
  );
  readonly displaySiteName = computed(() => {
    const supplied = this.normaliseText(this.siteName(), LINK_PREVIEW_LIMITS.siteName);
    return supplied || this.safeDestination()?.hostname || '';
  });

  onImageError(): void {
    this.failedImageUrl.set(this.sanitisedImage());
  }

  private normaliseText(value: string, maxLength: number): string {
    return this.sanitisation.sanitiseText(value).trim().slice(0, maxLength);
  }

  private normaliseHttpUrl(value: string): SafePreviewUrl | null {
    const sanitised = this.sanitisation.sanitiseUrl(value).trim();
    if (!sanitised) return null;

    try {
      const parsed = new URL(sanitised);
      if (
        (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
        parsed.username.length > 0 ||
        parsed.password.length > 0
      ) {
        return null;
      }

      const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
      return {
        href: parsed.href,
        hostname: parsed.hostname,
        displayAddress: `${parsed.hostname}${pathname}`,
      };
    } catch {
      return null;
    }
  }
}
