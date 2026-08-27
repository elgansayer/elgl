import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppTextareaComponent } from './textarea.component';

@Component({
  template: `
    <app-textarea
      [value]="value()"
      [placeholder]="placeholder()"
      [rows]="rows()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [label]="label()"
      [textareaId]="textareaId()"
      [customClass]="customClass()"
      (valueChange)="onValueChange($event)"
      (blurred)="onBlurred()"
      (focused)="onFocused()"
    />
  `,
  imports: [AppTextareaComponent],
})
class TestHostComponent {
  value = signal('initial bio');
  placeholder = signal('Tell us about yourself...');
  rows = signal(4);
  disabled = signal(false);
  readonly = signal(false);
  label = signal('Biography');
  textareaId = signal('bio-textarea');
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

describe('AppTextareaComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let textareaElement: HTMLTextAreaElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppTextareaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    textareaElement = fixture.nativeElement.querySelector('textarea');
  });

  it('should create and render label and textarea with correct attributes', () => {
    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeTruthy();
    expect(label.textContent?.trim()).toBe('Biography');
    expect(label.getAttribute('for')).toBe('bio-textarea');

    expect(textareaElement).toBeTruthy();
    expect(textareaElement.id).toBe('bio-textarea');
    expect(textareaElement.rows).toBe(4);
    expect(textareaElement.value).toBe('initial bio');
    expect(textareaElement.placeholder).toBe('Tell us about yourself...');
  });

  it('should generate a secure default textarea ID when none is provided', () => {
    const generatedFixture = TestBed.createComponent(AppTextareaComponent);
    generatedFixture.detectChanges();
    const generatedTextarea: HTMLTextAreaElement =
      generatedFixture.nativeElement.querySelector('textarea');

    expect(generatedTextarea.id).toMatch(
      /^app-textarea-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    generatedFixture.destroy();
  });

  it('should emit valueChange on input event when not disabled', () => {
    textareaElement.value = 'updated bio text';
    textareaElement.dispatchEvent(new Event('input'));
    expect(host.emittedValue).toBe('updated bio text');
  });

  it('should emit focused and blurred events', () => {
    textareaElement.dispatchEvent(new FocusEvent('focus'));
    expect(host.focusCount).toBe(1);

    textareaElement.dispatchEvent(new FocusEvent('blur'));
    expect(host.blurCount).toBe(1);
  });

  it('should apply owned Helm disabled semantics and not emit valueChange when disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(textareaElement.disabled).toBe(true);
    expect(textareaElement.classList.contains('disabled:cursor-not-allowed')).toBe(true);
    expect(textareaElement.classList.contains('disabled:opacity-50')).toBe(true);

    textareaElement.value = 'ignored text';
    textareaElement.dispatchEvent(new Event('input'));
    expect(host.emittedValue).toBe('');
  });

  it('should hide label when label signal is empty string', () => {
    host.label.set('');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeNull();
  });
});
