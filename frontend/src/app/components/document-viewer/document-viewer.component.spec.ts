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

  it('exposes the document as a named article without adding a nested main landmark', () => {
    const article: HTMLElement | null = fixture.nativeElement.querySelector('article');

    expect(article?.getAttribute('aria-label')).toBe('Privacy policy');
    expect(article?.querySelector('h1')?.textContent?.trim()).toBe('Privacy policy');
    expect(fixture.nativeElement.querySelector('main')).toBeNull();
  });

  it('keeps the accessible article name synchronized with the supplied title', () => {
    fixture.componentRef.setInput('title', 'Updated legal notice');
    fixture.detectChanges();

    const article: HTMLElement | null = fixture.nativeElement.querySelector('article');

    expect(article?.getAttribute('aria-label')).toBe('Updated legal notice');
    expect(article?.querySelector('h1')?.textContent?.trim()).toBe('Updated legal notice');
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

  it('keeps long translated and projected content reflow-safe at high zoom', () => {
    const wrapper: HTMLElement = fixture.nativeElement.querySelector('.max-w-4xl');
    const card: HTMLElement = fixture.nativeElement.querySelector('app-card');
    const heading: HTMLElement = fixture.nativeElement.querySelector('h1');
    const content: HTMLElement = fixture.nativeElement.querySelector('app-card > div');

    expect(wrapper.classList).toContain('min-w-0');
    expect(card.classList).toContain('min-w-0');
    expect(heading.classList).toContain('break-words');
    expect(content.classList).toContain('min-w-0');
    expect(content.classList).toContain('break-words');
    expect(content.classList).toContain('[overflow-wrap:anywhere]');
  });

  it('keeps the component direction-neutral and free of feature-owned motion', () => {
    const host = fixture.nativeElement as HTMLElement;
    const classNames = Array.from(
      host.querySelectorAll<HTMLElement>('[class]'),
      (element) => element.className,
    ).join(' ');

    expect(classNames).not.toMatch(
      /(?:^|\s)(?:ml-|mr-|pl-|pr-|left-|right-|text-left|text-right)/,
    );
    expect(classNames).not.toMatch(
      /(?:^|\s)(?:animate-|transition|duration-|delay-)/,
    );
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
