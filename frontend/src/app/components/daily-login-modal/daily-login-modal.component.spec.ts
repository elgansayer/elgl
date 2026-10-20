import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DailyLoginModalComponent } from './daily-login-modal.component';

describe('DailyLoginModalComponent', () => {
  let component: DailyLoginModalComponent;
  let fixture: ComponentFixture<DailyLoginModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyLoginModalComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DailyLoginModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate a secure unique dialog title ID', () => {
    expect(component.dialogTitleId).toMatch(
      /^daily-login-title-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('uses Relay surface, sheet radius, and elevation tokens', () => {
    const panel = fixture.debugElement.query(By.css('.rounded-sheet'));
    expect(panel).not.toBeNull();

    const classes = panel.nativeElement.classList;
    expect(classes.contains('border-surface-100')).toBe(true);
    expect(classes.contains('bg-surface-200')).toBe(true);
    expect(classes.contains('shadow-lift')).toBe(true);
    expect(classes.contains('rounded-2xl')).toBe(false);
    expect(classes.contains('rounded-3xl')).toBe(false);
    expect(classes.contains('shadow-2xl')).toBe(false);
  });

  it('keeps the modal within a mobile viewport and scales spacing at wider breakpoints', () => {
    const panel = fixture.debugElement.query(By.css('.rounded-sheet'));
    const classes = panel.nativeElement.classList;

    expect(classes.contains('w-[calc(100%-2rem)]')).toBe(true);
    expect(classes.contains('max-w-sm')).toBe(true);
    expect(classes.contains('max-h-[calc(100dvh-2rem)]')).toBe(true);
    expect(classes.contains('overflow-y-auto')).toBe(true);
    expect(classes.contains('p-5')).toBe(true);
    expect(classes.contains('sm:p-6')).toBe(true);
  });

  it('allows translated title, body, and CTA text to wrap', () => {
    const title = fixture.debugElement.query(By.css('h3'));
    const body = fixture.debugElement.query(By.css('p'));
    const button = fixture.debugElement.query(By.css('button'));

    expect(title.nativeElement.classList.contains('break-words')).toBe(true);
    expect(body.nativeElement.classList.contains('break-words')).toBe(true);
    expect(button.nativeElement.classList.contains('whitespace-normal')).toBe(true);
  });

  it('should display zero coins in body by default', () => {
    const bodyEl = fixture.debugElement.query(By.css('.text-text-secondary'));
    expect(bodyEl).not.toBeNull();
    expect(bodyEl.nativeElement.textContent).toContain('0 coins');
  });

  it('should display a supplied coin reward', () => {
    fixture.componentRef.setInput('coins', 8);
    fixture.detectChanges();

    const bodyEl = fixture.debugElement.query(By.css('.text-text-secondary'));
    expect(bodyEl.nativeElement.textContent).toContain('8 coins');
  });

  it('should display the title', () => {
    const titleEl = fixture.debugElement.query(By.css('h3'));
    expect(titleEl).not.toBeNull();
    expect(titleEl.nativeElement.textContent).toBeTruthy();
  });

  it('should display the CTA button', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).not.toBeNull();
    expect(button.nativeElement.textContent).toBeTruthy();
  });

  it('should delegate CTA dismissal to the Spartan dialog close primitive', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).not.toBeNull();
    expect(button.nativeElement.getAttribute('data-slot')).toBe('dialog-close');
  });

  it('should emit closed when the Spartan close action dismisses the dialog', async () => {
    const closedSpy = vi.fn();
    const subscription = component.closed.subscribe(closedSpy);
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).not.toBeNull();

    button.nativeElement.click();
    await fixture.whenStable();

    expect(closedSpy).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('should emit closed for dialog-originated dismissal while controlled open', () => {
    const closedSpy = vi.fn();
    const subscription = component.closed.subscribe(closedSpy);

    component.onDialogStateChanged('closed');

    expect(closedSpy).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('should not emit a duplicate close after the parent has closed the modal', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    const closedSpy = vi.fn();
    const subscription = component.closed.subscribe(closedSpy);

    component.onDialogStateChanged('closed');

    expect(closedSpy).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
});
