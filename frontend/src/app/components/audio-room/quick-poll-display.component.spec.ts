import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QuickPollDisplayComponent } from './quick-poll-display.component';

describe('QuickPollDisplayComponent', () => {
  let component: QuickPollDisplayComponent;
  let fixture: ComponentFixture<QuickPollDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickPollDisplayComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(QuickPollDisplayComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', {
      poll_id: 'poll-1',
      question: 'Next topic?',
      options: ['Travel', 'Food'],
      votes: [2, 1],
      totalVotes: 3,
      is_active: true,
      userVote: null,
    });
    fixture.componentRef.setInput('allowVote', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders aggregate results with numeric and progressbar cues', () => {
    const progressBars = fixture.debugElement.queryAll(By.css('[role="progressbar"]'));

    expect(progressBars).toHaveLength(2);
    expect(progressBars[0].nativeElement.getAttribute('aria-valuenow')).toBe('67');
    expect(progressBars[1].nativeElement.getAttribute('aria-valuenow')).toBe('33');
    expect(component.votePercentage(0)).toBe(67);
  });

  it('emits the selected option from a keyboard-operable native button', () => {
    const voted = vi.fn();
    const subscription = component.vote.subscribe(voted);
    const voteButtons = fixture.debugElement
      .queryAll(By.css('button'))
      .filter(
        (button) =>
          !button.nativeElement.hasAttribute('data-slot') ||
          button.nativeElement.textContent.includes('Vote'),
      );

    const optionButton = voteButtons.find((button) =>
      button.nativeElement.getAttribute('aria-label')?.includes('Travel'),
    );
    expect(optionButton).toBeDefined();
    optionButton?.nativeElement.click();

    expect(voted).toHaveBeenCalledWith(0);
    subscription.unsubscribe();
  });

  it('shows the caller vote and removes further vote actions', () => {
    fixture.componentRef.setInput('selectedOptionIndex', 1);
    fixture.componentRef.setInput('allowVote', false);
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Your vote');
    expect(
      fixture.debugElement
        .queryAll(By.css('button'))
        .some((button) => button.nativeElement.textContent?.trim().startsWith('Vote')),
    ).toBe(false);
  });

  it('emits close when the dialog is dismissed and remains RTL safe', () => {
    const closed = vi.fn();
    const subscription = component.closed.subscribe(closed);

    component.onDialogStateChanged('closed');

    expect(closed).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-/);
    subscription.unsubscribe();
  });
});
