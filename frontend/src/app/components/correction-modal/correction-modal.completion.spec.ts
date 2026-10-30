import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { CorrectionModalComponent } from './correction-modal.component';

const componentDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(componentDirectory, '../../../..');

describe('CorrectionModalComponent completion contract', () => {
  let component: CorrectionModalComponent;
  let fixture: ComponentFixture<CorrectionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CorrectionModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CorrectionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('originalText', 'I goes to market yesterday.');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('appends quick tags without losing a trimmed explanation', () => {
    component.explanation.set('  Use past tense  ');

    component.addQuickTag('Grammar');

    expect(component.explanation()).toBe('Use past tense [Grammar]');
  });

  it('starts an empty explanation with the selected quick tag', () => {
    component.explanation.set('   ');

    component.addQuickTag('Typo');

    expect(component.explanation()).toBe('[Typo]');
  });

  describe('quick tags', () => {
    function tagButtons(): HTMLButtonElement[] {
      return Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).filter(
        (button) => button.textContent?.trim().startsWith('+'),
      );
    }

    it('renders one button per tag in the interface language', () => {
      expect(tagButtons().map((button) => button.textContent?.trim())).toEqual([
        '+ Natural phrasing',
        '+ Grammar',
        '+ Typo',
        '+ Vocabulary',
      ]);
    });

    it('follows the interface language and inserts the translated label', () => {
      const i18n = TestBed.inject(I18nService);
      i18n.translations.update((dictionary) => ({
        ...dictionary,
        'correction.tag.grammar': 'Gramática',
      }));
      fixture.detectChanges();

      const button = tagButtons().find((candidate) => candidate.textContent?.includes('Gramática'));
      expect(button).toBeDefined();
      button?.click();

      expect(component.explanation()).toBe('[Gramática]');
    });

    it('renders every tag when two labels read the same in the interface language', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const i18n = TestBed.inject(I18nService);
      i18n.translations.update((dictionary) => ({
        ...dictionary,
        'correction.tag.grammar': 'Same',
        'correction.tag.typo': 'Same',
      }));
      fixture.detectChanges();

      expect(tagButtons().map((button) => button.textContent?.trim())).toEqual([
        '+ Natural phrasing',
        '+ Same',
        '+ Same',
        '+ Vocabulary',
      ]);
      // Angular reports a repeated @for track key as NG0955; tags are tracked by key, not label.
      expect(warn.mock.calls.flat().join(' ')).not.toContain('NG0955');
      warn.mockRestore();
    });

    it('keeps user-facing tag labels out of the component source', () => {
      const source = readFileSync(
        resolve(componentDirectory, 'correction-modal.component.ts'),
        'utf8',
      );

      for (const label of ['Natural phrasing', 'Grammar', 'Typo', 'Vocabulary']) {
        expect(source).not.toMatch(new RegExp(`['"]${label}['"]`));
      }
      expect(source).toContain('correction.tag.naturalPhrasing');
    });
  });

  it('shows the live diff only after the correction differs from the original', () => {
    expect(document.body.querySelector('app-visual-diff')).toBeNull();

    component.correctedText.set('I went to the market yesterday.');
    fixture.detectChanges();

    const diff = document.body.querySelector('app-visual-diff');
    expect(diff).not.toBeNull();
  });

  it('passes the current tutor explanation into the live diff', () => {
    component.correctedText.set('I went to the market yesterday.');
    component.explanation.set('Use the past tense here.');
    fixture.detectChanges();

    const diff = fixture.debugElement.query(By.directive(VisualDiffComponent));

    expect(diff.componentInstance.explanation()).toBe('Use the past tense here.');
  });
});

describe('Correction modal Relay and design-preview contract', () => {
  const template = readFileSync(resolve(componentDirectory, 'correction-modal.component.html'), 'utf8');
  const preview = readFileSync(
    resolve(frontendRoot, 'design-preview/components/correction-modal.html'),
    'utf8',
  );

  it('keeps the runtime surface on Relay semantic tokens and RTL-safe placement', () => {
    expect(template).toContain('bg-surface-200');
    expect(template).toContain('text-text-primary');
    expect(template).toContain('hlmBtn');
    expect(template).toContain('size="touch"');
    expect(template).toContain('variant="secondary"');
    expect(template).not.toContain('from-primary to-secondary');
    expect(template).toContain('end-2');
    expect(template).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('preserves responsive high-zoom and reduced-motion safeguards', () => {
    expect(template).toContain('max-h-[calc(100dvh-2rem)]');
    expect(template).toContain('overflow-y-auto');
    expect(template).toContain('flex-wrap');
    expect(template).toContain('motion-reduce:transition-none');
  });

  it('keeps explicit light-mobile and dark-wide correction states in the design preview', () => {
    expect(preview).toContain('class="correction-modal-preview light mobile"');
    expect(preview).toContain('aria-label="Correction modal light mobile preview"');
    expect(preview).toContain('class="correction-modal-preview dark wide"');
    expect(preview).toContain('aria-label="Correction modal dark wide preview"');
    expect(preview).toContain('.correction-modal-preview.light');
    expect(preview).toContain('.correction-modal-preview.dark');
    expect(preview).toContain('.correction-modal-preview.wide .modal');
  });
});
