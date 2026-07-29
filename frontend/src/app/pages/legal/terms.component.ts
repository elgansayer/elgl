import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DocumentViewerComponent } from '../../components/document-viewer/document-viewer.component';

@Component({
  selector: 'app-terms',
  imports: [DocumentViewerComponent, DatePipe],
  template: `
    <app-document-viewer title="Terms of Service">
      <p class="mb-4">Last updated: {{ currentDate | date }}</p>
      <h2 class="text-xl font-semibold mt-6 mb-2 text-white">1. Acceptance of Terms</h2>
      <p class="mb-4">
        By accessing and using this application, you accept and agree to be bound by the terms and
        provision of this agreement.
      </p>
      <h2 class="text-xl font-semibold mt-6 mb-2 text-white">2. User Conduct</h2>
      <p class="mb-4">
        You agree to use the service for lawful purposes only and in a way that does not infringe
        the rights of, restrict or inhibit anyone else's use and enjoyment of the service.
      </p>
    </app-document-viewer>
  `,
})
export class TermsComponent {
  currentDate = new Date();
}
