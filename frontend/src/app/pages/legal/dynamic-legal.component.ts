import { Component, computed, inject, input, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-dynamic-legal',
  imports: [HlmButton, LegalDocumentViewerComponent, TranslatePipe],
  template: `
    @if (docResource.isLoading()) {
      <main
        class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary"
        aria-busy="true"
        data-testid="legal-loading"
      >
        <div
          class="mx-auto max-w-3xl rounded-2xl border border-surface-200 bg-surface-100 p-5"
          role="status"
          aria-live="polite"
        >
          {{ loadingKey() | t }}
        </div>
      </main>
    } @else if (docResource.error()) {
      <main class="min-h-screen bg-surface-500 px-4 py-8 text-text-secondary">
        <section
          class="mx-auto max-w-3xl rounded-2xl border border-danger/30 bg-surface-100 p-5"
          role="alert"
          data-testid="legal-error"
        >
          <h1 class="text-2xl font-bold text-text-primary">{{ documentTitleKey() | t }}</h1>
          <p class="mt-3 text-sm text-text-secondary">
            {{ errorKey() | t }}
          </p>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="mt-4"
            (click)="retry()"
            data-testid="legal-retry"
          >
            {{ 'legal.retry' | t }}
          </button>
        </section>
      </main>
    } @else if (docResource.hasValue()) {
      @let doc = docResource.value();
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
export class DynamicLegalComponent {
  private readonly legalService = inject(LegalService);

  readonly type = input<string>('terms');

  private readonly normalisedType = computed(() => {
    const raw = this.type();
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  });

  readonly isTerms = computed(() =>
    ['terms', 'terms-of-service'].includes(this.normalisedType()),
  );

  readonly isPrivacy = computed(() =>
    ['privacy', 'privacy-policy'].includes(this.normalisedType()),
  );

  readonly documentTitleKey = computed(() => {
    if (this.isTerms()) {
      return 'legal.termsOfService';
    }
    if (this.isPrivacy()) {
      return 'legal.privacyPolicy';
    }
    return 'legal.document';
  });

  readonly loadingKey = computed(() => {
    if (this.isTerms()) {
      return 'legal.loadingTerms';
    }
    if (this.isPrivacy()) {
      return 'legal.loadingPrivacy';
    }
    return 'legal.loadingDocument';
  });

  readonly errorKey = computed(() => {
    if (this.isTerms()) {
      return 'legal.errorTerms';
    }
    if (this.isPrivacy()) {
      return 'legal.errorPrivacy';
    }
    return 'legal.errorDocument';
  });

  readonly docResource = resource({
    params: () => this.normalisedType(),
    loader: ({ params }) => this.legalService.fetchDocument(params || 'terms'),
  });

  retry(): void {
    this.docResource.reload();
  }
}
