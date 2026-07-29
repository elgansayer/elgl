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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize correctedText with originalText', () => {
    expect(component.correctedText()).toBe('I goes to market yesterday.');
  });

  it('should emit submitted when correction is made', () => {
    const spy = vi.spyOn(component.submitted, 'emit');
    component.correctedText.set('I went to the market yesterday.');
    component.explanation.set('Use past tense "went" instead of "goes".');

    component.submitCorrection();

    expect(spy).toHaveBeenCalledWith({
      original: 'I goes to market yesterday.',
      corrected: 'I went to the market yesterday.',
      explanation: 'Use past tense "went" instead of "goes".',
    });
  });

  it('should emit cancelled on closeModal', () => {
    const spy = vi.spyOn(component.cancelled, 'emit');
    component.closeModal();
    expect(spy).toHaveBeenCalled();
  });
});
