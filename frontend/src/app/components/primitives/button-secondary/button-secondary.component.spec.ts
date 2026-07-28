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

  it('should apply secondary styles and size md by default', () => {
    expect(buttonElement.classList.contains('bg-surface-100')).toBe(true);
    expect(buttonElement.classList.contains('text-text-primary')).toBe(true);
    expect(buttonElement.classList.contains('border')).toBe(true);
    expect(buttonElement.classList.contains('ps-4')).toBe(true);
  });

  it('should emit clicked event when clicked and not disabled', () => {
    buttonElement.click();
    expect(host.clickCount).toBe(1);
  });

  it('should apply disabled classes when disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(buttonElement.disabled).toBe(true);
    expect(buttonElement.classList.contains('cursor-not-allowed')).toBe(true);
    expect(buttonElement.classList.contains('bg-surface-100')).toBe(true);
  });
});
