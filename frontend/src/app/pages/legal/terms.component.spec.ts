import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsComponent } from './terms.component';
import { DatePipe } from '@angular/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { LegalDocumentViewerComponent, LegalSection } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { Component, Input, input } from '@angular/core';

@Component({
  selector: 'app-legal-document-viewer',
  template: '<div></div>',
  standalone: true
})
class MockLegalDocumentViewerComponent {
  title = input.required<string>();
  @Input() lastUpdated!: Date | string;
  @Input() sections!: LegalSection[];
}

describe('TermsComponent', () => {
  let component: TermsComponent;
  let fixture: ComponentFixture<TermsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsComponent, DatePipe]
    })
    .overrideComponent(TermsComponent, {
      remove: { imports: [LegalDocumentViewerComponent] },
      add: { imports: [MockLegalDocumentViewerComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(TermsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
