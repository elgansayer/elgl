import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacyComponent } from './privacy.component';
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

const PRIVACY_DOCUMENT: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: '2026-07-01',
  sections: [
    { id: 'info-collect', heading: '1. Information We Collect', content: 'Test content.' },
  ],
};

describe('PrivacyComponent', () => {
  let legalService: LegalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), LegalService],
    })
      .overrideComponent(PrivacyComponent, {
        remove: { imports: [LegalDocumentViewerComponent] },
        add: { imports: [MockLegalDocumentViewerComponent] },
      })
      .compileComponents();

    legalService = TestBed.inject(LegalService);
  });

  function createFixture(): ComponentFixture<PrivacyComponent> {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    vi.spyOn(legalService, 'fetchPrivacyPolicy').mockResolvedValue(PRIVACY_DOCUMENT);
    const fixture = createFixture();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load privacy policy from LegalService', async () => {
    const fetchPrivacy = vi
      .spyOn(legalService, 'fetchPrivacyPolicy')
      .mockResolvedValue(PRIVACY_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchPrivacy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.privacyResource.value()?.title).toBe('Privacy Policy');
  });

  it('should expose an accessible loading state while privacy policy is pending', () => {
    vi.spyOn(legalService, 'fetchPrivacyPolicy').mockImplementation(
      () => new Promise<LegalDocument>(() => undefined),
    );
    const fixture = createFixture();

    const loading = fixture.nativeElement.querySelector('[data-testid="privacy-loading"]');
    expect(loading).toBeTruthy();
    expect(loading.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should render an alert and retry after a load failure', async () => {
    const fetchPrivacy = vi
      .spyOn(legalService, 'fetchPrivacyPolicy')
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(PRIVACY_DOCUMENT);
    const fixture = createFixture();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retryButton = fixture.nativeElement.querySelector(
      '[data-testid="privacy-retry"]',
    ) as HTMLButtonElement;
    expect(retryButton).toBeTruthy();
    expect(retryButton.type).toBe('button');

    retryButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchPrivacy).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.privacyResource.value()?.title).toBe('Privacy Policy');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeFalsy();
  });
});
