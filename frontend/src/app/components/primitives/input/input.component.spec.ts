import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppInputComponent } from './input.component';

@Component({
  template: `
    <app-input
      [value]="value()"
      [placeholder]="placeholder()"
      [type]="type()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [label]="label()"
      [inputId]="inputId()"
      [customClass]="customClass()"
      (valueChange)="onValueChange($event)"
      (blurred)="onBlurred()"
      (focused)="onFocused()"
    />
  `,
  imports: [AppInputComponent],
})
class TestHostComponent {
  value = signal('initial');
  placeholder = signal('Type here...');
  type = signal<'text' | 'email' | 'password' | 'number' | 'url'>('text');
  disabled = signal(false);
  readonly = signal(false);
  label = signal('Email Address');
  inputId = signal('email-input');
  customClass = signal('');
  emittedValue = '';
  blurCount = 0;
  focusCount = 0;

  onValueChange(val: string): void {
    this.emittedValue = val;
  }

  onBlurred(): void {
    this.blurCount++;
  }

  onFocused(): void {
    this.focusCount++;
  }
}

describe('AppInputComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let inputElement: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    inputElement = fixture.nativeElement.querySelector('input');
  });

  it('should create and render label and input with correct attributes', () => {
    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeTruthy();
    expect(label.textContent?.trim()).toBe('Email Address');
    expect(label.getAttribute('for')).toBe('email-input');

    expect(inputElement).toBeTruthy();
    expect(inputElement.id).toBe('email-input');
    expect(inputElement.type).toBe('text');
    expect(inputElement.value).toBe('initial');
    expect(inputElement.placeholder).toBe('Type here...');
  });

  it('should generate a secure default input ID when none is provided', () => {
    const generatedFixture = TestBed.createComponent(AppInputComponent);
    generatedFixture.detectChanges();
    const generatedInput: HTMLInputElement = generatedFixture.nativeElement.querySelector('input');

    expect(generatedInput.id).toMatch(
      /^app-input-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    generatedFixture.destroy();
  });

  it('should emit valueChange on input event when not disabled', () => {
    inputElement.value = 'new text';
    inputElement.dispatchEvent(new Event('input'));
    expect(host.emittedValue).toBe('new text');
  });

  it('should emit focused and blurred events', () => {
    inputElement.dispatchEvent(new FocusEvent('focus'));
    expect(host.focusCount).toBe(1);

    inputElement.dispatchEvent(new FocusEvent('blur'));
    expect(host.blurCount).toBe(1);
  });

  it('should apply owned Helm disabled semantics and not emit valueChange when disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(inputElement.disabled).toBe(true);
    expect(inputElement.classList.contains('disabled:cursor-not-allowed')).toBe(true);
    expect(inputElement.classList.contains('disabled:opacity-50')).toBe(true);

    inputElement.value = 'ignored';
    inputElement.dispatchEvent(new Event('input'));
    expect(host.emittedValue).toBe('');
  });

  it('should hide label when label signal is empty string', () => {
    host.label.set('');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeNull();
  });
});
