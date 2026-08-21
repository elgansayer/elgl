import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsComponent } from './terms.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService, LegalDocument } from '../../services/legal.service';
import { Component, input } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

@Component({
  selector: 'app-legal-document-viewer',
  template: '<div></div>',
  standalone: true,
})
class MockLegalDocumentViewerComponent {
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<Date | string>();
  readonly sections = input.required<any[]>();
}

const TERMS_DOCUMENT: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: '2026-07-01',
  sections: [
    { id: 'acceptance', heading: '1. Acceptance of Terms', content: 'Test content.' },
  ],
};

describe('TermsComponent', () => {
  let legalService: LegalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), LegalService],
    })
      .overrideComponent(TermsComponent, {
        remove: { imports: [LegalDocumentViewerComponent] },
        add: { imports: [MockLegalDocumentViewerComponent] },
      })
      .compileComponents();

    legalService = TestBed.inject(LegalService);
  });

  function createFixture(): ComponentFixture<TermsComponent> {
    const fixture = TestBed.createComponent(TermsComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    vi.spyOn(legalService, 'fetchTermsOfService').mockResolvedValue(TERMS_DOCUMENT);
    const fixture = createFixture();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load terms of service from LegalService', async () => {
    const fetchTerms = vi
      .spyOn(legalService, 'fetchTermsOfService')
      .mockResolvedValue(TERMS_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchTerms).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.termsResource.value()?.title).toBe('Terms of Service');
  });

  it('should expose an accessible loading state while terms are pending', () => {
    vi.spyOn(legalService, 'fetchTermsOfService').mockImplementation(
      () => new Promise<LegalDocument>(() => undefined),
    );
    const fixture = createFixture();

    const loading = fixture.nativeElement.querySelector('[data-testid="terms-loading"]');
    expect(loading).toBeTruthy();
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should render an alert and retry after a load failure', async () => {
    const fetchTerms = vi
      .spyOn(legalService, 'fetchTermsOfService')
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(TERMS_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retryButton = fixture.nativeElement.querySelector(
      '[data-testid="terms-retry"]',
    ) as HTMLButtonElement;
    expect(retryButton).toBeTruthy();
    expect(retryButton.type).toBe('button');

    retryButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchTerms).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.termsResource.value()?.title).toBe('Terms of Service');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeFalsy();
  });
});
