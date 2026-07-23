import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppButtonPrimaryComponent } from './button-primary.component';

@Component({
  template: `
    <app-button-primary
      [size]="size()"
      [disabled]="disabled()"
      [type]="type()"
      [customClass]="customClass()"
      (clicked)="onClicked()"
    >
      Click Me
    </app-button-primary>
  `,
  imports: [AppButtonPrimaryComponent]
})
class TestHostComponent {
  size = signal<'sm' | 'md' | 'lg'>('md');
  disabled = signal<boolean>(false);
  type = signal<'button' | 'submit' | 'reset'>('button');
  customClass = signal('');
  clickCount = 0;

  onClicked(): void {
    this.clickCount++;
  }
}

describe('AppButtonPrimaryComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let buttonElement: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppButtonPrimaryComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    buttonElement = fixture.nativeElement.querySelector('button');
  });

  it('should create and render projected content inside inner button', () => {
    expect(buttonElement).toBeTruthy();
    expect(buttonElement.textContent?.trim()).toBe('Click Me');
    expect(buttonElement.type).toBe('button');
  });

  it('should apply primary styles and size md by default', () => {
    expect(buttonElement.classList.contains('bg-primary')).toBe(true);
    expect(buttonElement.classList.contains('text-white')).toBe(true);
    expect(buttonElement.classList.contains('ps-4')).toBe(true);
    expect(buttonElement.classList.contains('pe-4')).toBe(true);
  });

  it('should emit clicked event when clicked and not disabled', () => {
    buttonElement.click();
    expect(host.clickCount).toBe(1);
  });

  it('should not emit clicked event when disabled and apply disabled classes', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(buttonElement.disabled).toBe(true);
    expect(buttonElement.classList.contains('cursor-not-allowed')).toBe(true);
    expect(buttonElement.classList.contains('bg-surface-200')).toBe(true);

    buttonElement.click();
    expect(host.clickCount).toBe(0);
  });

  it('should update classes on size change to lg and customClass', () => {
    host.size.set('lg');
    host.customClass.set('my-btn');
    fixture.detectChanges();

    expect(buttonElement.classList.contains('ps-6')).toBe(true);
    expect(buttonElement.classList.contains('pe-6')).toBe(true);
    expect(buttonElement.classList.contains('my-btn')).toBe(true);
  });
});
