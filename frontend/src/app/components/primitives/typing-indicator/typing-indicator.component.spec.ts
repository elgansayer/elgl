import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TypingIndicatorComponent, TypingUser } from './typing-indicator.component';
import { I18nService } from '../../../services/i18n.service';

@Component({
  template: ` <app-typing-indicator [typingUsers]="users()"></app-typing-indicator> `,
  imports: [TypingIndicatorComponent],
})
class TestHostComponent {
  users = signal<TypingUser[]>([]);
}

const dictionary: Record<string, string> = {
  'typingIndicator.single': '{{name}} is typing...',
  'typingIndicator.multiple': '{{names}} are typing...',
  'typingIndicator.many': '{{names}} and {{count}} others are typing...',
  'typingIndicator.someone': 'Someone',
};

describe('TypingIndicatorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  const language = signal('en-GB');
  const mockI18n = {
    currentLang: language,
    translate: (key: string, params?: Record<string, unknown>) =>
      (dictionary[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(params?.[name] ?? ''),
      ),
  };

  function status(): HTMLElement | null {
    return fixture.debugElement.query(By.css('[role="status"]'))?.nativeElement ?? null;
  }

  beforeEach(async () => {
    language.set('en-GB');
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, TypingIndicatorComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be hidden when no users are typing', () => {
    host.users.set([]);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(TypingIndicatorComponent))).toBeTruthy();
    expect(status()).toBeNull();
  });

  it('announces a single typist politely with the same translated sentence it shows', () => {
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();

    const element = status();
    expect(element?.getAttribute('aria-label')).toBe('Alice is typing...');
    expect(element?.getAttribute('aria-live')).toBe('polite');
    expect(element?.textContent).toContain('Alice is typing...');
  });

  it('lists two or three typists with a locale-aware conjunction', () => {
    host.users.set([
      { userId: '1', displayName: 'Alice' },
      { userId: '2', displayName: 'Bob' },
    ]);
    fixture.detectChanges();
    expect(status()?.getAttribute('aria-label')).toBe('Alice and Bob are typing...');

    host.users.set([
      { userId: '1', displayName: 'Alice' },
      { userId: '2', displayName: 'Bob' },
      { userId: '3', displayName: 'Chloe' },
    ]);
    fixture.detectChanges();
    const label = status()?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Alice');
    expect(label).toContain('Chloe');
    expect(label).toMatch(/are typing\.\.\.$/);
  });

  it('summarises a crowd as the first names plus a count of the others', () => {
    host.users.set(
      ['Alice', 'Bob', 'Chloe', 'David', 'Eve'].map((displayName, index) => ({
        userId: String(index),
        displayName,
      })),
    );
    fixture.detectChanges();

    expect(status()?.getAttribute('aria-label')).toBe(
      'Alice, Bob, Chloe and 2 others are typing...',
    );
    expect(fixture.debugElement.queryAll(By.css('img')).length).toBeLessThanOrEqual(3);
    expect(status()?.textContent).toContain('+2');
  });

  it('uses the translated placeholder when a name is unknown', () => {
    host.users.set([{ userId: '1', displayName: '   ' }]);
    fixture.detectChanges();

    expect(status()?.getAttribute('aria-label')).toBe('Someone is typing...');
  });

  it('re-renders the sentence when the interface language changes', () => {
    dictionary['typingIndicator.single'] = '{{name}} schreibt...';
    language.set('de');
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();

    expect(status()?.getAttribute('aria-label')).toBe('Alice schreibt...');
    dictionary['typingIndicator.single'] = '{{name}} is typing...';
  });

  it('renders a trusted avatar decoratively and falls back to an initial', () => {
    host.users.set([
      { userId: '1', displayName: 'Alice', avatarUrl: 'https://cdn.example/alice.png' },
      { userId: '2', displayName: 'bob' },
    ]);
    fixture.detectChanges();

    const image = fixture.debugElement.query(By.css('img')).nativeElement as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://cdn.example/alice.png');
    expect(image.getAttribute('alt')).toBe('');
    const initial = fixture.debugElement.query(By.css('span[aria-hidden="true"].rounded-full'));
    expect(initial.nativeElement.textContent.trim()).toBe('B');
  });

  it('renders three decorative bouncing dots hidden from assistive technology', () => {
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.typing-dot')).length).toBe(3);
    const dots = fixture.debugElement.query(By.css('.typing-dot')).parent?.nativeElement as HTMLElement;
    expect(dots.getAttribute('aria-hidden')).toBe('true');
  });

  it('turns motion off for people who prefer reduced motion and uses no physical direction utilities', () => {
    const source = readFileSync(
      'src/app/components/primitives/typing-indicator/typing-indicator.component.ts',
      'utf8',
    );

    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).not.toMatch(/\b(?:pl|pr|ml|mr)-\d/);
    expect(source).not.toMatch(/\btext-white|bg-black|neon-/);
  });
});
