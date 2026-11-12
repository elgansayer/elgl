import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { I18nService } from '../../services/i18n.service';
import { LegalDocument, LegalSection, LegalService } from '../../services/legal.service';
import { DynamicLegalComponent } from './dynamic-legal.component';

@Component({
  selector: 'app-legal-document-viewer',
  template: '<div></div>',
})
class MockLegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<LegalSection[]>();
}

const TERMS_DOCUMENT: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: '2026-07-01',
  sections: [{ id: 'acceptance', heading: '1. Acceptance of Terms', content: 'Test content.' }],
};

const PRIVACY_DOCUMENT: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: '2026-07-01',
  sections: [
    { id: 'information-we-collect', heading: '1. Information We Collect', content: 'Test content.' },
  ],
};

describe('DynamicLegalComponent', () => {
  let legalService: LegalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicLegalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LegalService,
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => {
              const dict: Record<string, string> = {
                'legal.loadingTerms': 'Loading Terms of Service...',
                'legal.termsOfService': 'Terms of Service',
                'legal.errorTerms': 'We could not load the Terms of Service. Please try again.',
                'legal.loadingPrivacy': 'Loading Privacy Policy...',
                'legal.privacyPolicy': 'Privacy Policy',
                'legal.errorPrivacy': 'We could not load the Privacy Policy. Please try again.',
                'legal.loadingDocument': 'Loading legal document...',
                'legal.document': 'Legal Information',
                'legal.errorDocument': 'We could not load the legal document. Please try again.',
                'legal.retry': 'Try again',
              };
              return dict[key] ?? key;
            },
            currentLang: signal('en-GB'),
          },
        },
      ],
    })
      .overrideComponent(DynamicLegalComponent, {
        remove: { imports: [LegalDocumentViewerComponent] },
        add: { imports: [MockLegalDocumentViewerComponent] },
      })
      .compileComponents();

    legalService = TestBed.inject(LegalService);
  });

  function createFixture(): ComponentFixture<DynamicLegalComponent> {
    const fixture = TestBed.createComponent(DynamicLegalComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create with default terms type', async () => {
    vi.spyOn(legalService, 'fetchDocument').mockResolvedValue(TERMS_DOCUMENT);
    const fixture = createFixture();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.type()).toBe('terms');
  });

  it('loads terms of service by default and delegates to LegalService', async () => {
    const fetchDoc = vi.spyOn(legalService, 'fetchDocument').mockResolvedValue(TERMS_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchDoc).toHaveBeenCalledWith('terms');
    expect(fixture.componentInstance.docResource.value()?.title).toBe('Terms of Service');
  });

  it('loads privacy policy when configured with privacy type', async () => {
    const fetchDoc = vi.spyOn(legalService, 'fetchDocument').mockResolvedValue(PRIVACY_DOCUMENT);
    const fixture = TestBed.createComponent(DynamicLegalComponent);
    fixture.componentRef.setInput('type', 'privacy');
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchDoc).toHaveBeenCalledWith('privacy');
    expect(fixture.componentInstance.docResource.value()?.title).toBe('Privacy Policy');
  });

  it('reloads the document when the route type input changes', async () => {
    const fetchDoc = vi
      .spyOn(legalService, 'fetchDocument')
      .mockResolvedValueOnce(TERMS_DOCUMENT)
      .mockResolvedValueOnce(PRIVACY_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.componentRef.setInput('type', 'privacy');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fetchDoc).toHaveBeenNthCalledWith(1, 'terms');
    expect(fetchDoc).toHaveBeenNthCalledWith(2, 'privacy');
    expect(fixture.componentInstance.docResource.value()?.title).toBe('Privacy Policy');
  });

  it('exposes an accessible loading state while document is pending', () => {
    vi.spyOn(legalService, 'fetchDocument').mockImplementation(
      () => new Promise<LegalDocument>(() => undefined),
    );
    const fixture = createFixture();

    const loading = fixture.nativeElement.querySelector('[data-testid="legal-loading"]');
    expect(loading).toBeTruthy();
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loading.textContent).toContain('Loading Terms of Service...');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders an alert and retry button after load failure', async () => {
    const fetchDoc = vi
      .spyOn(legalService, 'fetchDocument')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(TERMS_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain(
      'We could not load the Terms of Service. Please try again.',
    );

    const retryButton = fixture.nativeElement.querySelector(
      '[data-testid="legal-retry"]',
    ) as HTMLButtonElement;
    expect(retryButton).toBeTruthy();
    expect(retryButton.type).toBe('button');

    retryButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchDoc).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.docResource.value()?.title).toBe('Terms of Service');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeFalsy();
  });
});
