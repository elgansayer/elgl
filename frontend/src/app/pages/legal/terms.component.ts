import { Component, inject, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-terms',
  imports: [HlmButton, LegalDocumentViewerComponent, TranslatePipe],
  template: `
    @if (termsResource.isLoading()) {
      <main
        class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary"
        aria-busy="true"
        data-testid="terms-loading"
      >
        <div
          class="mx-auto max-w-3xl rounded-2xl border border-surface-200 bg-surface-100 p-5"
          role="status"
          aria-live="polite"
        >
          {{ 'legal.loadingTerms' | t }}
        </div>
      </main>
    } @else if (termsResource.error()) {
      <main class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary">
        <section
          class="mx-auto max-w-3xl rounded-2xl border border-danger/30 bg-surface-100 p-5"
          role="alert"
          data-testid="terms-error"
        >
          <h1 class="text-2xl font-bold text-text-primary">{{ 'legal.termsOfService' | t }}</h1>
          <p class="mt-3 text-sm text-text-secondary">
            {{ 'legal.errorTerms' | t }}
          </p>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="mt-4"
            (click)="retry()"
            data-testid="terms-retry"
          >
            {{ 'legal.retry' | t }}
          </button>
        </section>
      </main>
    } @else if (termsResource.hasValue()) {
      @let doc = termsResource.value();
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
export class TermsComponent {
  private readonly legalService = inject(LegalService);

  readonly termsResource = resource({
    loader: () => this.legalService.fetchTermsOfService(),
  });

  retry(): void {
    this.termsResource.reload();
  }
}
