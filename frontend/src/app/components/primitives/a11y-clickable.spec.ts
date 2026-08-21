import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { A11yClickableDirective } from './a11y-clickable';

@Component({
  standalone: true,
  imports: [A11yClickableDirective],
  template: `<div tabindex="0" (click)="counter = counter + 1" (keydown)="onKey()" appA11yClickable data-testid="clickable">Click me</div>`,
})
class TestHostComponent {
  counter = 0;
  onKey(): void { /* noop - handled by A11yClickableDirective */ }
}

describe('A11yClickableDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('adds role="button" to the host element', () => {
    const el = fixture.debugElement.query(By.css('[data-testid="clickable"]')).nativeElement;
    expect(el.getAttribute('role')).toBe('button');
  });

  it('adds tabindex="0" to the host element', () => {
    const el = fixture.debugElement.query(By.css('[data-testid="clickable"]')).nativeElement;
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('fires click handler on Enter keydown', () => {
    const el = fixture.debugElement.query(By.css('[data-testid="clickable"]')).nativeElement;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    el.dispatchEvent(event);
    expect(component.counter).toBe(1);
  });

  it('fires click handler on Space keydown', () => {
    const el = fixture.debugElement.query(By.css('[data-testid="clickable"]')).nativeElement;
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    el.dispatchEvent(event);
    expect(component.counter).toBe(1);
  });

  it('does not respond to other keys', () => {
    const el = fixture.debugElement.query(By.css('[data-testid="clickable"]')).nativeElement;
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    el.dispatchEvent(event);
    expect(component.counter).toBe(0);
  });
});