import { Component } from '@angular/core';
import { LegalDocumentViewerComponent, LegalSection } from '../../components/legal-document-viewer/legal-document-viewer.component';

@Component({
  selector: 'app-terms',
  imports: [LegalDocumentViewerComponent],
  template: `
    <app-legal-document-viewer
      title="Terms of Service"
      [lastUpdated]="currentDate"
      [sections]="sections"
    ></app-legal-document-viewer>
  `,
})
export class TermsComponent {
  currentDate = new Date();

  sections: LegalSection[] = [
    {
      id: 'acceptance',
      heading: '1. Acceptance of Terms',
      content: 'By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.',
    },
    {
      id: 'conduct',
      heading: '2. User Conduct',
      content: 'You agree to use the service for lawful purposes only and in a way that does not infringe the rights of, restrict or inhibit anyone else\'s use and enjoyment of the service.',
    }
  ];
}
