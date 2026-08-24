import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LegalDocumentViewerComponent } from './legal-document-viewer.component';
import type { LegalSection } from '../../services/legal.service';

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
  lastUpdated: Date | string = '2026-08-01';
  sections: LegalSection[] = [
    { id: 'section-1', heading: '1. First Section', content: 'First section content.' },
    { id: 'section-2', heading: '2. Second Section', content: 'Second section content.' },
  ];
}

describe('LegalDocumentViewerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let viewerElement: HTMLElement;

  async function refresh(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    viewerElement = fixture.nativeElement.querySelector('app-legal-document-viewer');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    await refresh();
  });

  it('renders the document title and semantic Relay surface', () => {
    expect(viewerElement).toBeTruthy();
    expect(viewerElement.classList.contains('bg-surface-500')).toBe(true);
    expect(viewerElement.classList.contains('min-h-screen')).toBe(true);

    const h1 = viewerElement.querySelector('#legal-document-title');
    expect(h1?.textContent?.trim()).toBe('Test Document');
    expect(viewerElement.querySelector('main')?.getAttribute('aria-labelledby')).toBe(
      'legal-document-title',
    );
  });

  it('renders all sections with stable deep-link targets', () => {
    const sections = viewerElement.querySelectorAll('section');
    expect(sections.length).toBe(2);
    expect(sections[0]?.id).toBe('section-1');
    expect(sections[0]?.getAttribute('aria-labelledby')).toBe('section-1-heading');
    expect(sections[0]?.querySelector('h2')?.textContent?.trim()).toBe('1. First Section');
    expect(sections[0]?.querySelector('p')?.textContent?.trim()).toBe('First section content.');

    const links = viewerElement.querySelectorAll('nav[aria-label="Document sections"] a');
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute('href')).toBe('#section-1');
    expect(links[1]?.getAttribute('href')).toBe('#section-2');
  });

  it('renders a machine-readable last-updated date without timezone drift', () => {
    const time = viewerElement.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-08-01');
    expect(time?.textContent).toContain('August');
    expect(time?.textContent).toContain('2026');
    expect(time?.textContent).toMatch(/\b1\b/);
  });

  it('supports Date inputs for lastUpdated', async () => {
    host.lastUpdated = new Date(Date.UTC(2026, 5, 15, 12));
    await refresh();

    const time = viewerElement.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-06-15');
    expect(time?.textContent).toContain('June');
    expect(time?.textContent).toContain('15');
    expect(time?.textContent).toContain('2026');
  });

  it('renders an accessible unavailable state when no sections are supplied', async () => {
    host.sections = [];
    await refresh();

    expect(viewerElement.querySelectorAll('section').length).toBe(0);
    expect(viewerElement.querySelector('[data-testid="legal-empty"][role="status"]')).toBeTruthy();
    expect(viewerElement.querySelector('nav')).toBeFalsy();
  });

  it('renders legal content as text instead of interpreting supplied markup', async () => {
    host.sections = [
      {
        id: 'safe-content',
        heading: '<strong>Heading</strong>',
        content: '<img src=x onerror=alert(1)>Visible text',
      },
    ];
    await refresh();

    const section = viewerElement.querySelector('#safe-content');
    expect(section?.querySelector('strong')).toBeFalsy();
    expect(section?.querySelector('img')).toBeFalsy();
    expect(section?.querySelector('h2')?.textContent).toContain('<strong>Heading</strong>');
    expect(section?.querySelector('p')?.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('falls back to text when an invalid date is supplied directly', async () => {
    host.lastUpdated = 'not-a-date';
    await refresh();

    expect(viewerElement.querySelector('time')).toBeFalsy();
    expect(viewerElement.textContent).toContain('Last updated:');
    expect(viewerElement.textContent).toContain('not-a-date');
  });
});
