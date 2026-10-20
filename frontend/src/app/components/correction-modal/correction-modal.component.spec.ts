import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { CorrectionModalComponent } from './correction-modal.component';

describe('CorrectionModalComponent', () => {
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

  it('should create with an open labelled Spartan dialog', () => {
    expect(component).toBeTruthy();
    expect(component.dialogState()).toBe('open');

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).not.toBeNull();
  });

  it('should initialize correctedText with originalText', () => {
    expect(component.correctedText()).toBe('I goes to market yesterday.');
  });

  it('should reset correctedText to originalText', () => {
    component.correctedText.set('I went to the market yesterday.');

    component.onOriginalClick();

    expect(component.correctedText()).toBe('I goes to market yesterday.');
  });

  it('should not submit an empty or unchanged correction', () => {
    const spy = vi.spyOn(component.submitted, 'emit');

    component.correctedText.set('   ');
    component.submitCorrection();
    component.correctedText.set('  I goes to market yesterday.  ');
    component.submitCorrection();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit a trimmed correction and explanation', () => {
    const spy = vi.spyOn(component.submitted, 'emit');
    component.correctedText.set('  I went to the market yesterday.  ');
    component.explanation.set('  Use past tense "went" instead of "goes".  ');

    component.submitCorrection();

    expect(spy).toHaveBeenCalledWith({
      original: 'I goes to market yesterday.',
      corrected: 'I went to the market yesterday.',
      explanation: 'Use past tense "went" instead of "goes".',
    });
  });

  it('should pass the tutor explanation to the live diff flashcard action', () => {
    component.correctedText.set('I went to the market yesterday.');
    component.explanation.set('Use past tense "went" instead of "goes".');
    fixture.detectChanges();

    const visualDiff = fixture.debugElement.query(By.directive(VisualDiffComponent));

    expect(visualDiff).not.toBeNull();
    expect(visualDiff.componentInstance.explanation()).toBe(
      'Use past tense "went" instead of "goes".',
    );
  });

  it('should omit an empty explanation', () => {
    const spy = vi.spyOn(component.submitted, 'emit');
    component.correctedText.set('I went to the market yesterday.');
    component.explanation.set('   ');

    component.submitCorrection();

    expect(spy).toHaveBeenCalledWith({
      original: 'I goes to market yesterday.',
      corrected: 'I went to the market yesterday.',
      explanation: undefined,
    });
  });

  it('should associate visible labels with the editable fields without fixed reusable ids', () => {
    const correctedField = document.body.querySelector<HTMLTextAreaElement>('label textarea');
    const explanationField = document.body.querySelector<HTMLInputElement>(
      'label input[type="text"]',
    );

    expect(correctedField).not.toBeNull();
    expect(explanationField).not.toBeNull();
    expect(correctedField?.id).toBe('');
    expect(explanationField?.id).toBe('');
    expect(document.body.querySelector('#correction-corrected-text')).toBeNull();
    expect(document.body.querySelector('#correction-explanation')).toBeNull();
  });

  it('should let the browser resolve mixed-direction user text', () => {
    const originalText = document.body.querySelector<HTMLElement>('[role="group"] span[dir="auto"]');
    const correctedField = document.body.querySelector<HTMLTextAreaElement>('textarea[dir="auto"]');
    const explanationField = document.body.querySelector<HTMLInputElement>('input[dir="auto"]');

    expect(originalText).not.toBeNull();
    expect(correctedField).not.toBeNull();
    expect(explanationField).not.toBeNull();
  });

  it('should expose all actions as native non-submit buttons', () => {
    const buttons = document.body.querySelectorAll<HTMLButtonElement>('button');

    expect(buttons.length).toBeGreaterThanOrEqual(8);
    for (const button of buttons) {
      expect(button.type).toBe('button');
    }
  });

  it('should expose dialog close actions as explicit non-submit buttons', () => {
    const closeButtons = document.body.querySelectorAll<HTMLButtonElement>(
      'button[data-slot="dialog-close"]',
    );

    expect(closeButtons.length).toBe(2);
    for (const button of closeButtons) {
      expect(button.type).toBe('button');
    }
  });

  it('should preserve scrollable high-zoom access to wrapped footer actions', () => {
    const content = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const footer = document.body.querySelector<HTMLElement>('footer');

    expect(content?.classList.contains('max-h-[calc(100dvh-2rem)]')).toBe(true);
    expect(footer?.classList.contains('flex-wrap')).toBe(true);
  });

  it('should disable feature-owned transitions when reduced motion is requested', () => {
    const transitionedButtons = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button[class*="transition"]'),
    );

    expect(transitionedButtons.length).toBeGreaterThan(0);
    for (const button of transitionedButtons) {
      expect(button.classList.contains('motion-reduce:transition-none')).toBe(true);
    }
  });

  it('should emit cancelled on closeModal', () => {
    const spy = vi.spyOn(component.cancelled, 'emit');

    component.closeModal();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
