import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEmptyStateComponent } from './empty-state.component';

describe('AppEmptyStateComponent', () => {
  let fixture: ComponentFixture<AppEmptyStateComponent>;
  let component: AppEmptyStateComponent;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppEmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppEmptyStateComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('creates a named empty-state region with stable defaults', () => {
    expect(component).toBeTruthy();
    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('Empty state');
    expect(component.icon()).toBe('📭');
    expect(component.title()).toBe('');
    expect(component.description()).toBe('');
    expect(component.actionLabel()).toBe('');
    expect(component.illustration()).toBe('');
  });

  it('renders the decorative default icon when no illustration is supplied', () => {
    const icon = host.querySelector('.empty-state-icon');

    expect(icon?.textContent?.trim()).toBe('📭');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('img')).toBeNull();
  });

  it('renders a decorative lazy illustration and suppresses the fallback icon', () => {
    fixture.componentRef.setInput('illustration', '/assets/empty.svg');
    fixture.detectChanges();

    const image = host.querySelector('img');
    expect(image?.getAttribute('src')).toBe('/assets/empty.svg');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.classList.contains('max-w-full')).toBe(true);
    expect(host.querySelector('.empty-state-icon')).toBeNull();
  });

  it('uses the visible title as the accessible region name', () => {
    fixture.componentRef.setInput('title', 'No conversations yet');
    fixture.componentRef.setInput(
      'description',
      'Start a new conversation to practise today.',
    );
    fixture.detectChanges();

    expect(host.getAttribute('aria-label')).toBe('No conversations yet');
    expect(host.querySelector('h3')?.textContent?.trim()).toBe('No conversations yet');
    expect(host.querySelector('p')?.textContent?.trim()).toBe(
      'Start a new conversation to practise today.',
    );
  });

  it('renders no optional copy or action when inputs are empty', () => {
    expect(host.querySelector('h3')).toBeNull();
    expect(host.querySelector('p')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });

  it('keeps the optional Spartan action native and reflow-safe', () => {
    fixture.componentRef.setInput('actionLabel', 'Find a language partner');
    fixture.detectChanges();

    const button = host.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.classList.contains('max-w-full')).toBe(true);
    expect(button?.classList.contains('whitespace-normal')).toBe(true);
  });

  it('emits actionClicked exactly once per activation', () => {
    fixture.componentRef.setInput('actionLabel', 'Retry');
    fixture.detectChanges();
    const emitted = vi.fn();
    component.actionClicked.subscribe(emitted);

    host.querySelector<HTMLButtonElement>('button')?.click();

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('keeps the surface on semantic Relay tokens without physical-direction utilities', () => {
    const classes = component.containerClasses();

    expect(classes).toContain('rounded-card');
    expect(classes).toContain('border-surface-100');
    expect(classes).toContain('bg-surface-300');
    expect(classes).toContain('min-w-0');
    expect(classes).toContain('max-w-full');
    expect(classes).not.toMatch(/(?:^|\s)(?:ml|mr|pl|pr|left|right)-/);
    expect(classes).not.toMatch(
      /(?:^|\s)(?:bg|text|border)-(?:red|blue|green|gray|slate|purple)-/,
    );
  });

  it('preserves caller classes after the primitive-owned Relay classes', () => {
    fixture.componentRef.setInput('customClass', 'min-h-48 gap-3');
    fixture.detectChanges();

    expect(component.containerClasses()).toMatch(/min-h-48 gap-3$/);
  });

  it('keeps long copy and actions reflow-safe for the 390px mobile baseline', () => {
    fixture.componentRef.setInput(
      'title',
      'A very long translated empty state title that must wrap',
    );
    fixture.componentRef.setInput(
      'description',
      'Long translated descriptions should stay inside the shared surface instead of forcing horizontal page overflow.',
    );
    fixture.componentRef.setInput(
      'actionLabel',
      'Continue with a deliberately long translated primary action',
    );
    fixture.detectChanges();

    expect(host.classList.contains('min-w-0')).toBe(true);
    expect(host.classList.contains('max-w-full')).toBe(true);
    expect(host.querySelector('h3')?.classList.contains('break-words')).toBe(true);
    expect(host.querySelector('p')?.classList.contains('max-w-full')).toBe(true);
    expect(host.querySelector('button')?.classList.contains('whitespace-normal')).toBe(true);
  });
});
