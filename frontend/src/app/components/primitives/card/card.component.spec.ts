import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppCardComponent } from './card.component';

@Component({
  template: `
    <app-card [padding]="padding()" [variant]="variant()" [customClass]="customClass()">
      <p>Card content</p>
    </app-card>
  `,
  imports: [AppCardComponent],
})
class TestHostComponent {
  padding = signal<'none' | 'sm' | 'md' | 'lg'>('md');
  variant = signal<'default' | 'elevated' | 'outlined' | 'interactive'>('default');
  customClass = signal('');
}

describe('AppCardComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let cardElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    cardElement = fixture.nativeElement.querySelector('app-card');
  });

  it('should create the card and render projected content', () => {
    expect(cardElement).toBeTruthy();
    expect(cardElement.textContent?.trim()).toBe('Card content');
  });

  it('should apply default host classes and ARIA region role', () => {
    expect(cardElement.classList.contains('block')).toBe(true);
    expect(cardElement.classList.contains('rounded-card')).toBe(true);
    expect(cardElement.classList.contains('bg-surface-200')).toBe(true);
    expect(cardElement.classList.contains('transition-all')).toBe(true);
    expect(cardElement.classList.contains('ps-4')).toBe(true);
    expect(cardElement.classList.contains('pe-4')).toBe(true);
    expect(cardElement.classList.contains('pt-4')).toBe(true);
    expect(cardElement.classList.contains('pb-4')).toBe(true);
    expect(cardElement.classList.contains('border')).toBe(true);
    expect(cardElement.classList.contains('shadow-card')).toBe(true);
    expect(cardElement.getAttribute('role')).toBe('region');
    expect(cardElement.getAttribute('tabindex')).toBeNull();
  });

  it('should update classes and ARIA attributes when variant is interactive and padding is lg', () => {
    host.variant.set('interactive');
    host.padding.set('lg');
    host.customClass.set('extra-class');
    fixture.detectChanges();

    expect(cardElement.classList.contains('ps-6')).toBe(true);
    expect(cardElement.classList.contains('pe-6')).toBe(true);
    expect(cardElement.classList.contains('pt-6')).toBe(true);
    expect(cardElement.classList.contains('pb-6')).toBe(true);
    expect(cardElement.classList.contains('shadow-card')).toBe(true);
    expect(cardElement.classList.contains('hover:shadow-lift')).toBe(true);
    expect(cardElement.classList.contains('cursor-pointer')).toBe(true);
    expect(cardElement.classList.contains('extra-class')).toBe(true);
    expect(cardElement.getAttribute('role')).toBe('button');
    expect(cardElement.getAttribute('tabindex')).toBe('0');
  });
});
