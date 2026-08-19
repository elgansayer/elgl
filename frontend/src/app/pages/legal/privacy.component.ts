import { Component, inject, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';

@Component({
  selector: 'app-privacy',
  imports: [HlmButton, LegalDocumentViewerComponent],
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
          Loading Privacy Policy…
        </div>
      </main>
    } @else if (privacyResource.error()) {
      <main class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary">
        <section
          class="mx-auto max-w-3xl rounded-2xl border border-danger/30 bg-surface-100 p-5"
          role="alert"
          data-testid="privacy-error"
        >
          <h1 class="text-2xl font-bold text-text-primary">Privacy Policy</h1>
          <p class="mt-3 text-sm text-text-secondary">
            We could not load the Privacy Policy. Please try again.
          </p>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="mt-4"
            (click)="retry()"
            data-testid="privacy-retry"
          >
            Try again
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
