import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppDialogComponent } from './dialog.component';

@Component({
  template: `
    <app-dialog
      [open]="open()"
      [titleId]="titleId()"
      [size]="size()"
      [dismissible]="dismissible()"
      [customClass]="customClass()"
      (dismissed)="onDismissed()"
    >
      <h2 [id]="titleId()">Dialog title</h2>
      <p>Dialog body</p>
    </app-dialog>
  `,
  imports: [AppDialogComponent],
})
class TestHostComponent {
  open = signal(false);
  titleId = signal('test-dialog-title');
  size = signal<'sm' | 'md' | 'lg'>('md');
  dismissible = signal(true);
  customClass = signal('');
  dismissCount = 0;

  onDismissed(): void {
    this.dismissCount++;
  }
}

describe('AppDialogComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  function panel(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="dialog"]');
  }

  function backdrop(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.fixed.inset-0');
  }

  it('should render nothing when closed', () => {
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('should render the dialog with correct ARIA attributes when open', () => {
    host.open.set(true);
    fixture.detectChanges();

    const el = panel();
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-modal')).toBe('true');
    expect(el?.getAttribute('aria-labelledby')).toBe('test-dialog-title');
    expect(el?.textContent).toContain('Dialog title');
    expect(el?.textContent).toContain('Dialog body');
  });

  it('should apply the focus trap directive to the panel', () => {
    host.open.set(true);
    fixture.detectChanges();

    expect(panel()?.hasAttribute('cdktrapfocus')).toBe(true);
  });

  it('should react to the open signal toggling closed again', () => {
    host.open.set(true);
    fixture.detectChanges();
    expect(panel()).toBeTruthy();

    host.open.set(false);
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('should emit dismissed on backdrop click when dismissible', () => {
    host.open.set(true);
    fixture.detectChanges();

    backdrop()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.dismissCount).toBe(1);
  });

  it('should not emit dismissed on panel click (click stops propagation)', () => {
    host.open.set(true);
    fixture.detectChanges();

    panel()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.dismissCount).toBe(0);
  });

  it('should not emit dismissed on backdrop click when not dismissible', () => {
    host.dismissible.set(false);
    host.open.set(true);
    fixture.detectChanges();

    backdrop()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.dismissCount).toBe(0);
  });

  it('should emit dismissed on Escape when dismissible', () => {
    host.open.set(true);
    fixture.detectChanges();

    backdrop()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.dismissCount).toBe(1);
  });

  it('should apply the md size class by default and update on size change', () => {
    host.open.set(true);
    fixture.detectChanges();
    expect(panel()?.classList.contains('sm:max-w-md')).toBe(true);

    host.size.set('lg');
    fixture.detectChanges();
    expect(panel()?.classList.contains('sm:max-w-lg')).toBe(true);
    expect(panel()?.classList.contains('sm:max-w-md')).toBe(false);
  });

  it('should apply a custom class alongside the base panel classes', () => {
    host.customClass.set('my-custom-dialog');
    host.open.set(true);
    fixture.detectChanges();

    expect(panel()?.classList.contains('my-custom-dialog')).toBe(true);
    expect(panel()?.classList.contains('bg-surface-200')).toBe(true);
  });

  it('should lock body scroll while open and restore it when closed', () => {
    fixture.detectChanges();
    expect(document.body.style.overflow).not.toBe('hidden');

    host.open.set(true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    host.open.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
