import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { LegalDocumentViewerComponent, LegalSection } from './legal-document-viewer.component';

@Component({
  template: `
    <app-legal-document-viewer
      [title]="title"
      [lastUpdated]="lastUpdated"
      [sections]="sections"
    ></app-legal-document-viewer>
  `,
  imports: [LegalDocumentViewerComponent],
})
class TestHostComponent {
  title = 'Test Document';
  lastUpdated = '2026-08-01';
  sections: LegalSection[] = [
    { id: 'section-1', heading: '1. First Section', content: 'First section content.' },
    { id: 'section-2', heading: '2. Second Section', content: 'Second section content.' },
  ];
}

describe.skip('LegalDocumentViewerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let viewerElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, LegalDocumentViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    viewerElement = fixture.nativeElement.querySelector('app-legal-document-viewer');
  });

  it('should create', () => {
    expect(viewerElement).toBeTruthy();
  });

  it('should render the document title', () => {
    const h1 = viewerElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent?.trim()).toBe('Test Document');
  });

  it('should render all sections with headings and content', () => {
    const sections = viewerElement.querySelectorAll('section');
    expect(sections.length).toBe(2);

    const heading1 = sections[0].querySelector('h2');
    expect(heading1?.textContent?.trim()).toBe('1. First Section');
    expect(sections[0].querySelector('p')?.textContent?.trim()).toBe('First section content.');

    const heading2 = sections[1].querySelector('h2');
    expect(heading2?.textContent?.trim()).toBe('2. Second Section');
    expect(sections[1].querySelector('p')?.textContent?.trim()).toBe('Second section content.');
  });

  it('should display the last updated date', () => {
    const footer = viewerElement.querySelector('footer');
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain('Last updated:');
  });

  it('should apply dark background host class', () => {
    expect(viewerElement?.classList.contains('bg-[#121212]')).toBe(true);
    expect(viewerElement?.classList.contains('min-h-screen')).toBe(true);
  });

  it('should handle Date objects for lastUpdated', () => {
    const date = new Date('2026-06-15');
    host.lastUpdated = date.toISOString();
    fixture.detectChanges();
    const footer = viewerElement?.querySelector('footer');
    expect(footer?.textContent).toContain('Last updated:');
  });

  it('should render empty sections gracefully', () => {
    host.sections = [];
    fixture.detectChanges();
    const sections = viewerElement?.querySelectorAll('section');
    expect(sections?.length).toBe(0);
  });
});