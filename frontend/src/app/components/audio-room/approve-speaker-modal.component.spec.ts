import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApproveSpeakerModalComponent } from './approve-speaker-modal.component';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ApproveSpeakerModalComponent', () => {
  function createFixture(
    ids: string[],
  ): [ComponentFixture<ApproveSpeakerModalComponent>, ApproveSpeakerModalComponent] {
    const f = TestBed.createComponent(ApproveSpeakerModalComponent);
    const c = f.componentInstance;
    f.componentRef.setInput('raisedHandUserIds', ids);
    f.detectChanges();
    return [f, c];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApproveSpeakerModalComponent, TranslatePipe],
    }).compileComponents();
  });

  it('should create', () => {
    const [fixture, component] = createFixture([]);
    expect(component).toBeTruthy();
  });

  it('should set correct ARIA attributes on dialog', () => {
    const [fixture] = createFixture([]);
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('approve-speaker-title');
  });

  it('should show empty state when no raised hands', () => {
    const [fixture] = createFixture([]);
    expect(fixture.nativeElement.textContent).toContain('No pending speaker requests.');
  });

  it('should display raised hand users', () => {
    const [fixture] = createFixture(['user-abc12345', 'user-xyz67890']);
    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('U');
    expect(textContent).toContain('X');
    expect(textContent).toContain('user-abc');
    expect(textContent).toContain('user-xyz');
    expect(textContent).not.toContain('No pending speaker requests.');
  });

  it('should emit dismiss when close button clicked', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const closeButton = fixture.nativeElement.querySelector('button[aria-label]');
    expect(closeButton).toBeTruthy();
    closeButton.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit dismiss when backdrop clicked', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    backdrop.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not emit dismiss when dialog card clicked', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogCard).toBeTruthy();
    dialogCard.click();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit dismiss when Escape key pressed on dialog', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    dialogCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit dismiss when Escape key pressed on backdrop', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit approve with userId when approve button clicked', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.approve, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const approveButton = Array.from(buttons).find(
      (b: Element) => (b as HTMLElement).textContent?.trim() === 'Approve',
    ) as HTMLElement | undefined;
    expect(approveButton).toBeTruthy();
    approveButton!.click();
    expect(emitSpy).toHaveBeenCalledWith('user-abc12345');
  });

  it('should not dismiss when non-Escape key pressed on backdrop', () => {
    const [fixture, component] = createFixture(['user-abc12345']);
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(emitSpy).not.toHaveBeenCalled();
  });
});