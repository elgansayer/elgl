import { Component } from '@angular/core';
import { DocumentViewerComponent } from '../../components/document-viewer/document-viewer.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [DocumentViewerComponent],
  template: `
    <app-document-viewer title="Privacy Policy">
      <p class="mb-4">Last updated: {{ currentDate | date }}</p>
      <h2 class="text-xl font-semibold mt-6 mb-2 text-white">1. Information We Collect</h2>
      <p class="mb-4">We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us.</p>
      <h2 class="text-xl font-semibold mt-6 mb-2 text-white">2. How We Use Information</h2>
      <p class="mb-4">We may use the information we collect about you to provide, maintain, and improve our services.</p>
    </app-document-viewer>
  `
})
export class PrivacyComponent {
  currentDate = new Date();
}
