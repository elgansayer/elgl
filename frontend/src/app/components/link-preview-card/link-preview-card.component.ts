import { Component, input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';

@Component({
  selector: 'app-link-preview-card',
  imports: [CommonModule],
  template: `
    <a
      [href]="sanitisedUrl()"
      target="_blank"
      rel="noopener noreferrer"
      class="block mt-2 rounded-xl border border-surface-100 bg-surface-100 overflow-hidden hover:border-primary/40 transition-colors no-underline"
    >
      @if (sanitisedImage(); as img) {
        <div class="w-full h-36 overflow-hidden bg-surface-300">
          <img
            [src]="img"
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
            (error)="onImageError()"
          />
        </div>
      }
      <div class="ps-3 pe-3 pt-2.5 pb-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-primary/60 mb-1">
          {{ siteName() }}
        </p>
        @if (title()) {
          <p class="text-sm font-bold text-text-primary leading-snug line-clamp-2">
            {{ title() }}
          </p>
        }
        @if (description()) {
          <p class="text-xs text-text-secondary mt-1 line-clamp-2">
            {{ description() }}
          </p>
        }
        <p class="text-[10px] text-text-muted mt-1.5 truncate">
          {{ sanitisedUrl() }}
        </p>
      </div>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
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

  url = input<string>('');
  title = input('');
  description = input('');
  image = input('');
  siteName = input('');

  readonly sanitisedUrl = computed(() => this.sanitisation.sanitiseUrl(this.url()));
  readonly sanitisedImage = computed(() => {
    const img = this.image();
    return img ? this.sanitisation.sanitiseUrl(img) : '';
  });

  onImageError(): void {
    // Image failed to load; no fallback needed as the card works without it.
  }
}