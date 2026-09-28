import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('should create with an open Spartan dialog', () => {
    expect(component).toBeTruthy();
    expect(component.dialogState()).toBe('open');
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
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

  it('should associate visible labels with the editable fields', () => {
    const correctedLabel = document.body.querySelector<HTMLLabelElement>(
      'label[for="correction-corrected-text"]',
    );
    const explanationLabel = document.body.querySelector<HTMLLabelElement>(
      'label[for="correction-explanation"]',
    );

    expect(correctedLabel).not.toBeNull();
    expect(explanationLabel).not.toBeNull();
    expect(document.body.querySelector('#correction-corrected-text')).not.toBeNull();
    expect(document.body.querySelector('#correction-explanation')).not.toBeNull();
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

  it('should emit cancelled on closeModal', () => {
    const spy = vi.spyOn(component.cancelled, 'emit');

    component.closeModal();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
