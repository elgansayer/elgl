import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppSelectComponent } from './select.component';

@Component({
  template: `
    <app-select
      [value]="value()"
      [disabled]="disabled()"
      [label]="label()"
      [ariaLabel]="ariaLabel()"
      [customClass]="customClass()"
      (valueChange)="onValueChange($event)"
    >
      <option value="en">English</option>
      <option value="es">Spanish</option>
    </app-select>
  `,
  imports: [AppSelectComponent],
})
class TestHostComponent {
  value = signal('en');
  disabled = signal(false);
  label = signal('');
  ariaLabel = signal('');
  customClass = signal('');
  lastValue: string | null = null;

  onValueChange(value: string): void {
    this.lastValue = value;
  }
}

describe('AppSelectComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let selectElement: HTMLSelectElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    selectElement = fixture.nativeElement.querySelector('select');
  });

  it('should create and render projected options', () => {
    expect(selectElement).toBeTruthy();
    expect(selectElement.id).toMatch(
      /^app-select-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const options = selectElement.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[0].value).toBe('en');
  });

  it('should apply token-driven base classes', () => {
    expect(selectElement.classList.contains('rounded-app')).toBe(true);
    expect(selectElement.classList.contains('bg-surface-300')).toBe(true);
    expect(selectElement.classList.contains('border-surface-100')).toBe(true);
  });

  it('should not render a label when none is provided', () => {
    expect(fixture.nativeElement.querySelector('label')).toBeNull();
  });

  it('should render a translated label when provided', () => {
    host.label.set('settings.language');
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeTruthy();
    expect(label.getAttribute('for')).toBe(selectElement.id);
  });

  it('should emit valueChange with the selected value on change', () => {
    selectElement.value = 'es';
    selectElement.dispatchEvent(new Event('change'));
    expect(host.lastValue).toBe('es');
  });

  it('should apply disabled styles and not emit valueChange when disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(selectElement.disabled).toBe(true);
    expect(selectElement.classList.contains('cursor-not-allowed')).toBe(true);

    selectElement.value = 'es';
    selectElement.dispatchEvent(new Event('change'));
    expect(host.lastValue).toBeNull();
  });

  it('should apply a custom class alongside the base classes', () => {
    host.customClass.set('my-select');
    fixture.detectChanges();
    expect(selectElement.classList.contains('my-select')).toBe(true);
  });
});
