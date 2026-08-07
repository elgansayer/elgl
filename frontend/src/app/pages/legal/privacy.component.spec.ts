import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PrivacyComponent } from './privacy.component';
import { DatePipe } from '@angular/common';
import { describe, it, expect } from 'vitest';
import { LegalDocumentViewerComponent, LegalSection } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { Component, Input, input } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-legal-document-viewer',
  template: '<div></div>',
  standalone: true,
})
class MockLegalDocumentViewerComponent {
  title = input.required<string>();
  @Input() lastUpdated!: Date | string;
  @Input() sections!: LegalSection[];
  @Input() isLoading = false;
  @Input() error: unknown = null;
}

const mockDoc = {
  title: 'Privacy Policy',
  lastUpdated: '2026-08-01T00:00:00.000Z',
  sections: [
    { id: 'intro', heading: '1. Test', content: 'Test privacy content' },
  ],
};

describe('PrivacyComponent', () => {
  it('should fetch and display privacy policy from the backend', async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent, DatePipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(PrivacyComponent, {
        remove: { imports: [LegalDocumentViewerComponent] },
        add: { imports: [MockLegalDocumentViewerComponent] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(PrivacyComponent);
    const component = fixture.componentInstance;
    const httpTesting = TestBed.inject(HttpTestingController);

    expect(component).toBeTruthy();

    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiUrl}/legal/document/privacy`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDoc);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.documentResource.value()?.sections.length).toBe(1);
    expect(component.documentResource.value()?.title).toBe('Privacy Policy');

    httpTesting.verify();
  });
});
