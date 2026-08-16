import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppButtonSecondaryComponent } from './button-secondary.component';

@Component({
  template: `
    <app-button-secondary
      [size]="size()"
      [disabled]="disabled()"
      [type]="type()"
      [customClass]="customClass()"
      [ariaLabel]="ariaLabel()"
      [ariaPressed]="ariaPressed()"
      (clicked)="onClicked()"
    >
      Secondary Action
    </app-button-secondary>
  `,
  imports: [AppButtonSecondaryComponent],
})
class TestHostComponent {
  size = signal<'sm' | 'md' | 'lg'>('md');
  disabled = signal<boolean>(false);
  type = signal<'button' | 'submit' | 'reset'>('button');
  customClass = signal('');
  ariaLabel = signal('');
  ariaPressed = signal<boolean | null>(null);
  clickCount = 0;

  onClicked(): void {
    this.clickCount++;
  }
}

describe('AppButtonSecondaryComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let buttonElement: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppButtonSecondaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    buttonElement = fixture.nativeElement.querySelector('button');
  });

  it('should create and render projected content inside inner button', () => {
    expect(buttonElement).toBeTruthy();
    expect(buttonElement.textContent?.trim()).toBe('Secondary Action');
  });

  it('should apply owned Helm secondary styles and map legacy md to touch size', () => {
    expect(buttonElement.classList.contains('bg-secondary')).toBe(true);
    expect(buttonElement.classList.contains('text-secondary-foreground')).toBe(true);
    expect(buttonElement.classList.contains('border')).toBe(true);
    expect(buttonElement.classList.contains('rounded-app')).toBe(true);
    expect(buttonElement.classList.contains('min-h-11')).toBe(true);
  });

  it('should use the owned Helm secondary hover and focus-visible contract', () => {
    expect(buttonElement.classList.contains('hover:bg-secondary/80')).toBe(true);
    expect(buttonElement.classList.contains('focus-visible:ring-ring/50')).toBe(true);
  });

  it('should emit clicked event when clicked and not disabled', () => {
    buttonElement.click();
    expect(host.clickCount).toBe(1);
  });

  it('should expose native disabled state and Helm disabled semantics', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(buttonElement.disabled).toBe(true);
    expect(buttonElement.classList.contains('data-disabled:pointer-events-none')).toBe(true);
    expect(buttonElement.classList.contains('data-disabled:opacity-50')).toBe(true);
  });

  it('should not set an aria-label attribute by default', () => {
    expect(buttonElement.hasAttribute('aria-label')).toBe(false);
  });

  it('should expose an accessible name via aria-label for icon-only buttons', () => {
    host.ariaLabel.set('Start screen sharing');
    fixture.detectChanges();

    expect(buttonElement.getAttribute('aria-label')).toBe('Start screen sharing');
  });

  it('should not set aria-pressed by default', () => {
    expect(buttonElement.hasAttribute('aria-pressed')).toBe(false);
  });

  it('should reflect toggle state via aria-pressed when provided', () => {
    host.ariaPressed.set(true);
    fixture.detectChanges();

    expect(buttonElement.getAttribute('aria-pressed')).toBe('true');

    host.ariaPressed.set(false);
    fixture.detectChanges();

    expect(buttonElement.getAttribute('aria-pressed')).toBe('false');
  });
});
