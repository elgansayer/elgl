import { Component, inject, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-privacy',
  imports: [HlmButton, LegalDocumentViewerComponent, TranslatePipe],
  template: `
    @if (privacyResource.isLoading()) {
      <main
        class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary"
        aria-busy="true"
        data-testid="privacy-loading"
      >
        <div
          class="mx-auto max-w-3xl rounded-2xl border border-surface-200 bg-surface-100 p-5"
          role="status"
          aria-live="polite"
        >
          {{ 'legal.loadingPrivacy' | t }}
        </div>
      </main>
    } @else if (privacyResource.error()) {
      <main class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary">
        <section
          class="mx-auto max-w-3xl rounded-2xl border border-danger/30 bg-surface-100 p-5"
          role="alert"
          data-testid="privacy-error"
        >
          <h1 class="text-2xl font-bold text-text-primary">{{ 'legal.privacyPolicy' | t }}</h1>
          <p class="mt-3 text-sm text-text-secondary">
            {{ 'legal.errorPrivacy' | t }}
          </p>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="mt-4"
            (click)="retry()"
            data-testid="privacy-retry"
          >
            {{ 'legal.retry' | t }}
          </button>
        </section>
      </main>
    } @else if (privacyResource.hasValue()) {
      @let doc = privacyResource.value();
      @if (doc) {
        <app-legal-document-viewer
          [title]="doc.title"
          [lastUpdated]="doc.lastUpdated"
          [sections]="doc.sections"
        ></app-legal-document-viewer>
      }
    }
  `,
})
export class PrivacyComponent {
  private readonly legalService = inject(LegalService);

  readonly privacyResource = resource({
    loader: () => this.legalService.fetchPrivacyPolicy(),
  });

  retry(): void {
    this.privacyResource.reload();
  }
}
