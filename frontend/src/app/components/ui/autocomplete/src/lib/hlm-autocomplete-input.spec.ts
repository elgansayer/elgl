import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HlmAutocompleteInput } from './hlm-autocomplete-input';
import { HlmAutocompleteSearch } from './hlm-autocomplete-search';

@Component({
  imports: [HlmAutocompleteSearch, HlmAutocompleteInput],
  template: `
    <hlm-autocomplete-search>
      <hlm-autocomplete-input
        [showSearch]="false"
        [placeholder]="placeholder()"
        [ariaLabel]="ariaLabel()"
        [testId]="testId()"
        (inputEvent)="inputEvents.update((events) => [...events, $event])"
        (keyDown)="keyDownEvents.update((events) => [...events, $event])"
      />
    </hlm-autocomplete-search>
  `,
})
class TestHostComponent {
  readonly placeholder = signal('Type a message');
  readonly ariaLabel = signal<string | null>('Message composer');
  readonly testId = signal<string | null>('composer-input');
  readonly inputEvents = signal<Event[]>([]);
  readonly keyDownEvents = signal<KeyboardEvent[]>([]);
}

describe('HlmAutocompleteInput native input contract', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  function nativeInput(): HTMLInputElement {
    const element = fixture.nativeElement.querySelector('hlm-autocomplete-input input');
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('hlm-autocomplete-input must render a native <input>');
    }
    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('forwards testId to the native input so Playwright fill() targets an editable element', () => {
    const tagged = fixture.nativeElement.querySelectorAll('[data-testid="composer-input"]');

    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toBe(nativeInput());
  });

  it('keeps the wrapper element free of the data-testid attribute', () => {
    const wrapper = fixture.nativeElement.querySelector('hlm-autocomplete-input');

    expect(wrapper.hasAttribute('data-testid')).toBe(false);
  });

  it('follows testId changes and drops the attribute instead of rendering "null"', () => {
    host.testId.set('renamed-input');
    fixture.detectChanges();
    expect(nativeInput().getAttribute('data-testid')).toBe('renamed-input');

    host.testId.set(null);
    fixture.detectChanges();
    expect(nativeInput().hasAttribute('data-testid')).toBe(false);
  });

  it('renders an enabled, writable text input', () => {
    const input = nativeInput();

    expect(input.type).toBe('text');
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(false);
  });

  it('forwards the placeholder and accessible name to the native input', () => {
    expect(nativeInput().getAttribute('placeholder')).toBe('Type a message');
    expect(nativeInput().getAttribute('aria-label')).toBe('Message composer');

    host.placeholder.set('Escribe un mensaje');
    host.ariaLabel.set(null);
    fixture.detectChanges();

    expect(nativeInput().getAttribute('placeholder')).toBe('Escribe un mensaje');
    expect(nativeInput().hasAttribute('aria-label')).toBe(false);
  });

  it('emits native input and keydown events to the host', () => {
    const input = nativeInput();

    input.value = 'こんにちは';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(host.inputEvents()).toHaveLength(1);
    expect(host.inputEvents()[0].target).toBe(input);
    expect(host.keyDownEvents()).toHaveLength(1);
    expect(host.keyDownEvents()[0].key).toBe('Enter');
  });
});
