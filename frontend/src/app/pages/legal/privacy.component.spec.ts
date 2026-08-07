import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacyComponent } from './privacy.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LegalDocumentViewerComponent } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { LegalService } from '../../services/legal.service';
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

describe('PrivacyComponent', () => {
  let component: PrivacyComponent;
  let fixture: ComponentFixture<PrivacyComponent>;
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
    vi.spyOn(legalService, 'fetchPrivacyPolicy').mockResolvedValue({
      title: 'Privacy Policy',
      lastUpdated: '2026-07-01',
      sections: [
        { id: 'info-collect', heading: '1. Information We Collect', content: 'Test content.' },
      ],
    });

    fixture = TestBed.createComponent(PrivacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load privacy policy from LegalService', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(legalService.fetchPrivacyPolicy).toHaveBeenCalled();
    expect(component.privacyResource.value()?.title).toBe('Privacy Policy');
  });
});
