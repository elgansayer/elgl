import { Component, inject, resource } from '@angular/core';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';

@Component({
  selector: 'app-terms',
  imports: [LegalDocumentViewerComponent],
  template: `
    @let doc = termsResource.value();
    @if (doc) {
      <app-legal-document-viewer
        [title]="doc.title"
        [lastUpdated]="doc.lastUpdated"
        [sections]="doc.sections"
      ></app-legal-document-viewer>
    }
  `,
})
export class TermsComponent {
  private readonly legalService = inject(LegalService);

  readonly termsResource = resource({
    loader: () => this.legalService.fetchTermsOfService(),
  });
}
