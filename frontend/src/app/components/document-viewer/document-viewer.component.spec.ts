import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentViewerComponent } from './document-viewer.component';

@Component({
  imports: [DocumentViewerComponent],
  template: `
    <app-document-viewer title="Terms">
      <a href="#retention">Retention details</a>
      <button type="button">Caller action</button>
    </app-document-viewer>
  `,
})
class ProjectedContentHostComponent {}

describe('DocumentViewerComponent', () => {
  let fixture: ComponentFixture<DocumentViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentViewerComponent, ProjectedContentHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentViewerComponent);
    fixture.componentRef.setInput('title', 'Privacy policy');
    fixture.detectChanges();
  });

  it('renders the supplied title', () => {
    const heading: HTMLElement | null = fixture.nativeElement.querySelector('h1');

    expect(heading?.textContent?.trim()).toBe('Privacy policy');
    expect(heading?.classList).toContain('text-text-primary');
    expect(heading?.classList).toContain('text-2xl');
    expect(heading?.classList).toContain('sm:text-3xl');
  });

  it('uses Relay semantic surfaces and theme-neutral content styling', () => {
    const shell: HTMLElement = fixture.nativeElement.querySelector('.min-h-screen');
    const card: HTMLElement = fixture.nativeElement.querySelector('app-card');
    const content: HTMLElement = fixture.nativeElement.querySelector('app-card > div');

    expect(shell.classList).toContain('bg-surface-50');
    expect(shell.classList).toContain('text-text-secondary');
    expect(shell.classList).not.toContain('bg-surface-500');

    expect(card.classList).toContain('bg-surface-200');
    expect(card.classList).toContain('border-surface-100');
    expect(card.classList).toContain('shadow-lift');
    expect(card.classList).not.toContain('bg-surface-300');

    expect(content.classList).toContain('text-text-secondary');
    expect(content.classList).not.toContain('prose-invert');
  });

  it('uses mobile-first spacing that expands at tablet and desktop breakpoints', () => {
    const shell: HTMLElement = fixture.nativeElement.querySelector('.min-h-screen');
    const card: HTMLElement = fixture.nativeElement.querySelector('app-card');

    expect(shell.classList).toContain('px-4');
    expect(shell.classList).toContain('py-4');
    expect(shell.classList).toContain('sm:px-6');
    expect(shell.classList).toContain('sm:py-6');
    expect(shell.classList).toContain('lg:px-8');
    expect(shell.classList).toContain('lg:py-8');

    expect(card.classList).toContain('p-4');
    expect(card.classList).toContain('sm:p-6');
    expect(card.classList).toContain('lg:p-8');
  });

  it('does not manufacture command controls or synthetic keyboard behaviour', () => {
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('[role="button"]')).toBeNull();
    expect(host.querySelector('[tabindex]')).toBeNull();
  });

  it('leaves projected link and button semantics owned by the caller', () => {
    const hostFixture = TestBed.createComponent(ProjectedContentHostComponent);
    hostFixture.detectChanges();

    const link: HTMLAnchorElement | null = hostFixture.nativeElement.querySelector('a');
    const button: HTMLButtonElement | null = hostFixture.nativeElement.querySelector('button');

    expect(link?.getAttribute('href')).toBe('#retention');
    expect(link?.getAttribute('role')).toBeNull();
    expect(link?.getAttribute('tabindex')).toBeNull();
    expect(button?.type).toBe('button');
    expect(button?.getAttribute('role')).toBeNull();
    expect(button?.getAttribute('tabindex')).toBeNull();
  });
});
