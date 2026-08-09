import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsComponent } from './terms.component';
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
    vi.spyOn(legalService, 'fetchTermsOfService').mockResolvedValue({
      title: 'Terms of Service',
      lastUpdated: '2026-07-01',
      sections: [
        { id: 'acceptance', heading: '1. Acceptance of Terms', content: 'Test content.' },
      ],
    });

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
});
