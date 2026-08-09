import { Component, inject, resource } from '@angular/core';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';

@Component({
  selector: 'app-privacy',
  imports: [LegalDocumentViewerComponent],
  template: `
    @let doc = privacyResource.value();
    @if (doc) {
      <app-legal-document-viewer
        [title]="doc.title"
        [lastUpdated]="doc.lastUpdated"
        [sections]="doc.sections"
      ></app-legal-document-viewer>
    }
  `,
})
export class PrivacyComponent {
  private readonly legalService = inject(LegalService);

  readonly privacyResource = resource({
    loader: () => this.legalService.fetchPrivacyPolicy(),
  });
}
