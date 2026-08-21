import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { toastsSignal } from '../../../services/toast.service';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;

  beforeEach(async () => {
    toastsSignal.set([]);
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    toastsSignal.set([]);
  });

  function toastElements(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.pointer-events-auto'));
  }

  it('should render no toasts when the signal is empty', () => {
    expect(toastElements().length).toBe(0);
  });

  it('should render an info toast using the surface/text-primary tokens', () => {
    toastsSignal.set([{ id: 1, message: 'Saved', type: 'info' }]);
    fixture.detectChanges();

    const [el] = toastElements();
    expect(el.textContent?.trim()).toBe('Saved');
    expect(el.classList.contains('bg-surface-200')).toBe(true);
    expect(el.classList.contains('text-text-primary')).toBe(true);
    expect(el.classList.contains('bg-danger')).toBe(false);
    expect(el.classList.contains('bg-success')).toBe(false);
  });

  it('should render an error toast using the danger/on-fill tokens', () => {
    toastsSignal.set([{ id: 2, message: 'Something failed', type: 'error' }]);
    fixture.detectChanges();

    const [el] = toastElements();
    expect(el.classList.contains('bg-danger')).toBe(true);
    expect(el.classList.contains('text-on-fill')).toBe(true);
  });

  it('should render a success toast using the success/on-fill tokens', () => {
    toastsSignal.set([{ id: 3, message: 'Done', type: 'success' }]);
    fixture.detectChanges();

    const [el] = toastElements();
    expect(el.classList.contains('bg-success')).toBe(true);
    expect(el.classList.contains('text-on-fill')).toBe(true);
  });

  it('should render multiple toasts tracked by id', () => {
    toastsSignal.set([
      { id: 1, message: 'First', type: 'info' },
      { id: 2, message: 'Second', type: 'success' },
    ]);
    fixture.detectChanges();

    const els = toastElements();
    expect(els.length).toBe(2);
    expect(els[0].textContent?.trim()).toBe('First');
    expect(els[1].textContent?.trim()).toBe('Second');
  });

  it('should react to the signal updating after removal', () => {
    toastsSignal.set([{ id: 1, message: 'First', type: 'info' }]);
    fixture.detectChanges();
    expect(toastElements().length).toBe(1);

    toastsSignal.set([]);
    fixture.detectChanges();
    expect(toastElements().length).toBe(0);
  });
});
