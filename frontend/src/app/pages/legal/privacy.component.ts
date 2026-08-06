import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LegalDocumentViewerComponent, LegalSection } from '../../components/legal-document-viewer/legal-document-viewer.component';

@Component({
  selector: 'app-privacy',
  imports: [LegalDocumentViewerComponent, DatePipe],
  template: `
    <app-legal-document-viewer
      title="Privacy Policy"
      [lastUpdated]="currentDate"
      [sections]="sections"
    ></app-legal-document-viewer>
  `,
})
export class PrivacyComponent {
  currentDate = new Date();

  sections: LegalSection[] = [
    {
      id: 'information-we-collect',
      heading: '1. Information We Collect',
      content: 'We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us.',
    },
    {
      id: 'how-we-use-information',
      heading: '2. How We Use Information',
      content: 'We may use the information we collect about you to provide, maintain, and improve our services.',
    }
  ];
}
