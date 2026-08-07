import { Component, input, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { LinkPreview } from '../../services/chat.service';

@Component({
  selector: 'app-link-preview-card',
  imports: [TranslatePipe],
  template: `
    @if (preview(); as lp) {
      <a
        [href]="lp.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block mt-2 rounded-lg overflow-hidden border border-surface-100 bg-surface-200 hover:bg-surface-300 transition-colors no-underline"
        [attr.aria-label]="ariaLabel()"
      >
        @if (lp.image) {
          <div class="w-full h-32 overflow-hidden bg-surface-400">
            <img
              [src]="lp.image"
              [alt]="lp.title || lp.siteName || ''"
              class="w-full h-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              (error)="onImageError($event)"
            />
          </div>
        }
        <div class="ps-3 pe-3 pt-2 pb-2">
          @if (lp.siteName) {
            <p class="text-xs text-blue-400 font-medium uppercase tracking-wide">{{ lp.siteName }}</p>
          }
          @if (lp.title) {
            <p class="text-sm font-semibold text-white line-clamp-2 mt-0.5">{{ lp.title }}</p>
          }
          @if (lp.description) {
            <p class="text-xs text-surface-600 line-clamp-2 mt-0.5">{{ lp.description }}</p>
          }
        </div>
      </a>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      a {
        max-width: 320px;
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
  preview = input.required<LinkPreview>();
  private i18n = inject(I18nService);

  ariaLabel = computed(() =>
    this.i18n.translate('linkPreview.openLink', {
      title: this.preview().title || this.preview().siteName || this.preview().url,
    }),
  );

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}