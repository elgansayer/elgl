import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppGradientButtonComponent } from './gradient-button.component';

@Component({
  template: `
    <app-gradient-button
      [size]="size()"
      [disabled]="disabled()"
      [customClass]="customClass()"
      [ariaLabel]="ariaLabel()"
      (clicked)="onClicked()"
    >
      End call
    </app-gradient-button>
  `,
  imports: [AppGradientButtonComponent],
})
class TestHostComponent {
  size = signal<'sm' | 'md' | 'icon'>('md');
  disabled = signal<boolean>(false);
  customClass = signal('');
  ariaLabel = signal('');
  clickCount = 0;

  onClicked(): void {
    this.clickCount++;
  }
}

describe('AppGradientButtonComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let buttonElement: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppGradientButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    buttonElement = fixture.nativeElement.querySelector('button');
  });

  it('should create and render projected content inside inner button', () => {
    expect(buttonElement).toBeTruthy();
    expect(buttonElement.textContent?.trim()).toBe('End call');
  });

  it('should apply product gradient styles on the owned Helm touch size', () => {
    expect(buttonElement.classList.contains('bg-gradient-to-r')).toBe(true);
    expect(buttonElement.classList.contains('from-vip')).toBe(true);
    expect(buttonElement.classList.contains('to-accent')).toBe(true);
    expect(buttonElement.classList.contains('text-on-fill')).toBe(true);
    expect(buttonElement.classList.contains('rounded-pill')).toBe(true);
    expect(buttonElement.classList.contains('min-h-11')).toBe(true);
    expect(buttonElement.classList.contains('px-4')).toBe(true);
  });

  it('should emit clicked event when clicked and not disabled', () => {
    buttonElement.click();
    expect(host.clickCount).toBe(1);
  });

  it('should not emit clicked when disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    buttonElement.click();
    expect(host.clickCount).toBe(0);
  });

  it('should expose native and product disabled semantics', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(buttonElement.disabled).toBe(true);
    expect(buttonElement.classList.contains('bg-surface-300')).toBe(true);
    expect(buttonElement.classList.contains('opacity-50')).toBe(true);
  });

  it('should not set an aria-label attribute by default', () => {
    expect(buttonElement.hasAttribute('aria-label')).toBe(false);
  });

  it('should expose an accessible name via aria-label for icon-only buttons', () => {
    host.ariaLabel.set('End call');
    fixture.detectChanges();

    expect(buttonElement.getAttribute('aria-label')).toBe('End call');
  });
});
