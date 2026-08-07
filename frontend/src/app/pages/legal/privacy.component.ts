import { Component, inject, resource } from '@angular/core';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';

@Component({
  selector: 'app-privacy',
  imports: [LegalDocumentViewerComponent],
  template: `
    <app-legal-document-viewer
      title="Privacy Policy"
      [lastUpdated]="documentResource.value()?.lastUpdated ?? fallbackDate"
      [sections]="documentResource.value()?.sections ?? []"
      [isLoading]="documentResource.isLoading()"
      [error]="documentResource.error()"
    ></app-legal-document-viewer>
  `,
})
export class PrivacyComponent {
  private legalService = inject(LegalService);
  fallbackDate = new Date().toISOString();

  documentResource = resource({
    loader: () => this.legalService.getDocument('privacy'),
  });
}
