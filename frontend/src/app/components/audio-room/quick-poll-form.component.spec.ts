import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QuickPollFormComponent } from './quick-poll-form.component';

describe('QuickPollFormComponent', () => {
  let component: QuickPollFormComponent;
  let fixture: ComponentFixture<QuickPollFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuickPollFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(QuickPollFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders an accessible Spartan dialog with labelled bounded inputs', () => {
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    const title = fixture.debugElement.query(By.css('[data-slot="dialog-title"]'));
    const inputs = fixture.debugElement.queryAll(By.css('input'));

    expect(dialog).not.toBeNull();
    expect(title).not.toBeNull();
    expect(dialog.nativeElement.getAttribute('aria-labelledby')).toBe(title.nativeElement.id);
    expect(inputs).toHaveLength(3);
    expect(inputs[0].nativeElement.maxLength).toBe(300);
    expect(inputs[1].nativeElement.maxLength).toBe(100);
    expect(inputs.every((input) => input.nativeElement.labels.length === 1)).toBe(true);
    expect(inputs.every((input) => !input.nativeElement.hasAttribute('placeholder'))).toBe(true);
    expect(fixture.nativeElement.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-/);
  });

  it('caps the draft at six options and keeps stable option identities', () => {
    for (let index = 0; index < 6; index += 1) component.addOption();

    expect(component.options()).toHaveLength(6);
    expect(new Set(component.options().map((option) => option.id)).size).toBe(6);
    expect(component.canAddOption()).toBe(false);
  });

  it('emits a trimmed unique poll payload', () => {
    const emitted = vi.fn();
    const subscription = component.submitPoll.subscribe(emitted);
    component.question.set('  Next topic?  ');
    component.options.set([
      { id: 1, value: ' Travel ' },
      { id: 2, value: ' Food ' },
    ]);

    component.submit();

    expect(emitted).toHaveBeenCalledWith({
      question: 'Next topic?',
      options: ['Travel', 'Food'],
    });
    expect(component.showValidationError()).toBe(false);
    subscription.unsubscribe();
  });

  it('announces validation when options are blank or duplicated', () => {
    const emitted = vi.fn();
    const subscription = component.submitPoll.subscribe(emitted);
    component.question.set('Next topic?');
    component.options.set([
      { id: 1, value: 'Travel' },
      { id: 2, value: ' travel ' },
    ]);

    component.submit();
    fixture.detectChanges();

    expect(emitted).not.toHaveBeenCalled();
    expect(component.showValidationError()).toBe(true);
    expect(fixture.debugElement.query(By.css('[role="alert"]'))).not.toBeNull();
    subscription.unsubscribe();
  });

  it('emits cancellation for Escape, backdrop, or the close action', () => {
    const cancelled = vi.fn();
    const subscription = component.cancelled.subscribe(cancelled);

    component.onDialogStateChanged('closed');

    expect(cancelled).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });

  it('blocks duplicate submission while creation is in flight', async () => {
    const emitted = vi.fn();
    const subscription = component.submitPoll.subscribe(emitted);
    component.question.set('Next topic?');
    component.options.set([
      { id: 1, value: 'Travel' },
      { id: 2, value: 'Food' },
    ]);

    fixture.componentRef.setInput('submitting', true);
    await fixture.whenStable();
    component.submit();

    const busyButton = fixture.debugElement.query(By.css('button[aria-busy="true"]'));
    expect(busyButton).not.toBeNull();
    expect(busyButton.nativeElement.disabled).toBe(true);
    expect(emitted).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
});
