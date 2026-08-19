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
  let component: TermsComponent;
  let fixture: ComponentFixture<TermsComponent>;
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
    vi.spyOn(legalService, 'fetchTermsOfService').mockResolvedValue(TERMS_DOCUMENT);

    fixture = TestBed.createComponent(TermsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load terms of service from LegalService', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(legalService.fetchTermsOfService).toHaveBeenCalled();
    expect(component.termsResource.value()?.title).toBe('Terms of Service');
  });

  it('should expose an accessible loading state while terms are pending', () => {
    const fetchTerms = vi.mocked(legalService.fetchTermsOfService);
    fetchTerms.mockReset();
    fetchTerms.mockImplementation(() => new Promise<LegalDocument>(() => undefined));

    const loadingFixture = TestBed.createComponent(TermsComponent);
    loadingFixture.detectChanges();

    const loading = loadingFixture.nativeElement.querySelector('[data-testid="terms-loading"]');
    expect(loading).toBeTruthy();
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(loadingFixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should render an alert and retry after a load failure', async () => {
    const fetchTerms = vi.mocked(legalService.fetchTermsOfService);
    fetchTerms.mockReset();
    fetchTerms
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(TERMS_DOCUMENT);

    const errorFixture = TestBed.createComponent(TermsComponent);
    errorFixture.detectChanges();
    await errorFixture.whenStable();
    errorFixture.detectChanges();

    expect(errorFixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retryButton = errorFixture.nativeElement.querySelector(
      '[data-testid="terms-retry"]',
    ) as HTMLButtonElement;
    expect(retryButton).toBeTruthy();
    expect(retryButton.type).toBe('button');

    retryButton.click();
    errorFixture.detectChanges();
    await errorFixture.whenStable();
    errorFixture.detectChanges();

    expect(fetchTerms).toHaveBeenCalledTimes(2);
    expect(errorFixture.componentInstance.termsResource.value()?.title).toBe('Terms of Service');
    expect(errorFixture.nativeElement.querySelector('[role="alert"]')).toBeFalsy();
  });
});
