import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

class MockI18nService {
  translate(key: string, params?: Record<string, unknown>): string {
    if (!params) {
      return key;
    }

    let result = key;
    for (const [name, value] of Object.entries(params)) {
      result = result.replace(`{${name}}`, String(value));
    }
    return result;
  }
}

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let confirmService: ConfirmService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    confirmService = TestBed.inject(ConfirmService);
    fixture.detectChanges();
  });

  afterEach(() => {
    confirmService.dismiss(false);
    fixture.destroy();
  });

  it('should create closed when no confirmation is pending', () => {
    expect(component).toBeTruthy();
    expect(component.dialogState()).toBe('closed');
  });

  it('should use Relay sheet radius and elevation tokens for the dialog surface', async () => {
    void confirmService.confirm('Remove this item?');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');

    expect(dialog).not.toBeNull();
    expect(dialog?.classList.contains('rounded-sheet')).toBe(true);
    expect(dialog?.classList.contains('shadow-lift')).toBe(true);
    expect(dialog?.classList.contains('border-surface-100')).toBe(true);
    expect(dialog?.classList.contains('bg-surface-200')).toBe(true);
    expect(dialog?.classList.contains('rounded-2xl')).toBe(false);
    expect(dialog?.classList.contains('shadow-2xl')).toBe(false);
  });

  it('should stack full-width actions on mobile and restore the desktop action row', async () => {
    void confirmService.confirm('Remove this item?');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const actionRow = dialog?.querySelector<HTMLElement>('div.flex');
    const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button');

    expect(actionRow).not.toBeNull();
    expect(actionRow?.classList.contains('flex-col')).toBe(true);
    expect(actionRow?.classList.contains('sm:flex-row')).toBe(true);
    expect(actionRow?.classList.contains('sm:justify-end')).toBe(true);
    expect(buttons).toHaveLength(2);

    if (!buttons) {
      return;
    }

    for (const button of buttons) {
      expect(button.type).toBe('button');
      expect(button.classList.contains('w-full')).toBe(true);
      expect(button.classList.contains('sm:w-auto')).toBe(true);
      expect(button.getAttribute('size')).toBe('touch');
    }

    expect(buttons[0].classList.contains('bg-secondary')).toBe(true);
    expect(buttons[1].classList.contains('bg-primary')).toBe(true);
    expect(buttons[1].classList.contains('text-primary-foreground')).toBe(true);
  });
});
