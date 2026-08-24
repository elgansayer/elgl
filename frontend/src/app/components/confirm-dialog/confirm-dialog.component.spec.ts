import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmService } from '../../services/confirm.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let confirmService: ConfirmService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    confirmService = TestBed.inject(ConfirmService);
    fixture.detectChanges();
  });

  afterEach(() => {
    confirmService.dismiss(false);
  });

  function openConfirmation(message = 'Confirm this action'): Promise<boolean> {
    const result = confirmService.confirm(message);
    fixture.detectChanges();
    return result;
  }

  function actionButtons() {
    return fixture.debugElement.queryAll(By.css('button[data-slot="button"]'));
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should derive dialog state from the pending confirmation', async () => {
    expect(component.dialogState()).toBe('closed');

    const result = openConfirmation();

    expect(component.dialogState()).toBe('open');

    confirmService.dismiss(false);
    fixture.detectChanges();

    await expect(result).resolves.toBe(false);
    expect(component.dialogState()).toBe('closed');
  });

  it('should not render dialog content without an active confirmation', () => {
    expect(component.dialogState()).toBe('closed');
    expect(fixture.debugElement.query(By.css('[data-slot="dialog-content"]'))).toBeNull();
    expect(actionButtons()).toHaveLength(0);
  });

  it('should render native touch-sized Spartan actions in deterministic order', () => {
    openConfirmation();

    const buttons = actionButtons();

    expect(buttons).toHaveLength(2);
    expect(buttons[0].nativeElement.textContent.trim()).not.toBe('');
    expect(buttons[1].nativeElement.textContent.trim()).not.toBe('');
    expect(buttons[0].nativeElement.textContent.trim()).not.toBe(
      buttons[1].nativeElement.textContent.trim(),
    );
    for (const button of buttons) {
      expect(button.nativeElement.tagName).toBe('BUTTON');
      expect(button.nativeElement.type).toBe('button');
      expect(button.nativeElement.getAttribute('data-slot')).toBe('button');
      expect(button.nativeElement.classList.contains('min-h-11')).toBe(true);
      expect(button.nativeElement.classList.contains('whitespace-normal')).toBe(true);
      expect(button.nativeElement.classList.contains('break-words')).toBe(true);
      expect(button.nativeElement.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  it('should render caller-provided confirmation copy without treating it as a translation key', () => {
    openConfirmation('Delete 日本語 draft?\nThis cannot be undone.');

    const title = fixture.debugElement.query(By.css('[data-slot="dialog-title"]'));

    expect(title.nativeElement.textContent).toContain('Delete 日本語 draft?');
    expect(title.nativeElement.textContent).toContain('This cannot be undone.');
  });

  it('should resolve false when the Cancel action is activated', async () => {
    const result = openConfirmation();
    const [cancelButton] = actionButtons();

    cancelButton.nativeElement.click();
    fixture.detectChanges();

    await expect(result).resolves.toBe(false);
    expect(confirmService.confirmState()).toBeNull();
  });

  it('should resolve true when the Confirm action is activated', async () => {
    const result = openConfirmation();
    const [, confirmButton] = actionButtons();

    confirmButton.nativeElement.click();
    fixture.detectChanges();

    await expect(result).resolves.toBe(true);
    expect(confirmService.confirmState()).toBeNull();
  });

  it('should treat a Spartan dialog close transition as cancellation', async () => {
    const result = openConfirmation();

    component.onDialogStateChanged('closed');
    fixture.detectChanges();

    await expect(result).resolves.toBe(false);
    expect(confirmService.confirmState()).toBeNull();
  });

  it('should not dismiss for an open state event', async () => {
    const result = openConfirmation();
    const state = confirmService.confirmState();

    component.onDialogStateChanged('open');

    expect(confirmService.confirmState()).toBe(state);

    confirmService.dismiss(true);
    await expect(result).resolves.toBe(true);
  });

  it('should not resolve twice after the confirmation state has cleared', () => {
    const resolve = vi.fn();
    confirmService.confirmState.set({
      message: 'Confirm this action',
      resolve,
    });

    component.onDialogStateChanged('closed');
    component.onDialogStateChanged('closed');

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(false);
    expect(confirmService.confirmState()).toBeNull();
  });

  it('should use the Spartan dialog title contract without fixed ids', () => {
    openConfirmation('Delete this draft?');

    const dialogContent = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
    const title = fixture.debugElement.query(By.css('[data-slot="dialog-title"]'));
    const renderedHtml = dialogContent.nativeElement.outerHTML;

    expect(dialogContent).not.toBeNull();
    expect(title).not.toBeNull();
    expect(title.nativeElement.textContent).toContain('Delete this draft?');
    expect(title.nativeElement.id).toBeTruthy();
    expect(dialogContent.nativeElement.getAttribute('aria-labelledby')).toBe(title.nativeElement.id);
    expect(renderedHtml).not.toContain('confirm-message');
  });

  it('should keep required content scrollable at high zoom and narrow viewport heights', () => {
    openConfirmation();

    const dialogContent = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));

    expect(dialogContent.nativeElement.classList.contains('max-h-[calc(100dvh-2rem)]')).toBe(true);
    expect(dialogContent.nativeElement.classList.contains('overflow-y-auto')).toBe(true);
    expect(dialogContent.nativeElement.classList.contains('w-full')).toBe(true);
    expect(dialogContent.nativeElement.classList.contains('max-w-sm')).toBe(true);
  });

  it('should suppress dialog animation when reduced motion is requested', () => {
    openConfirmation();

    const dialogContent = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));

    expect(dialogContent.nativeElement.classList.contains('motion-reduce:animate-none')).toBe(true);
  });

  it('should preserve direction-neutral, reflow-safe action layout', () => {
    openConfirmation();

    const dialogContent = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
    const actionRow = dialogContent.query(By.css('div.flex'));
    const renderedHtml = dialogContent.nativeElement.outerHTML;

    expect(actionRow.nativeElement.classList.contains('gap-3')).toBe(true);
    expect(actionRow.nativeElement.classList.contains('sm:justify-end')).toBe(true);
    expect(renderedHtml).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-/);
  });
});
