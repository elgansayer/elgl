import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('shows the live diff only after the correction differs from the original', () => {
    expect(document.body.querySelector('app-visual-diff')).toBeNull();

    component.correctedText.set('I went to the market yesterday.');
    fixture.detectChanges();

    const diff = document.body.querySelector('app-visual-diff');
    expect(diff).not.toBeNull();
  });
});

describe('Correction modal Relay and design-preview contract', () => {
  const template = readFileSync(resolve(componentDirectory, 'correction-modal.component.html'), 'utf8');
  const preview = readFileSync(
    resolve(frontendRoot, 'design-preview/components/correction-modal.html'),
    'utf8',
  );

  it('keeps the runtime surface on Relay semantic tokens and RTL-safe placement', () => {
    expect(template).toContain('bg-surface-500');
    expect(template).toContain('text-text-primary');
    expect(template).toContain('from-primary to-secondary');
    expect(template).toContain('text-on-fill');
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
