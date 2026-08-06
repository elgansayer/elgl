import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacyComponent } from './privacy.component';
import { DatePipe } from '@angular/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { LegalDocumentViewerComponent, LegalSection } from '../../components/legal-document-viewer/legal-document-viewer.component';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-legal-document-viewer',
  template: '<div></div>',
  standalone: true
})
class MockLegalDocumentViewerComponent {
  @Input() title!: string;
  @Input() lastUpdated!: Date | string;
  @Input() sections!: LegalSection[];
}

describe('PrivacyComponent', () => {
  let component: PrivacyComponent;
  let fixture: ComponentFixture<PrivacyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyComponent, DatePipe]
    })
    .overrideComponent(PrivacyComponent, {
      remove: { imports: [LegalDocumentViewerComponent] },
      add: { imports: [MockLegalDocumentViewerComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrivacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
