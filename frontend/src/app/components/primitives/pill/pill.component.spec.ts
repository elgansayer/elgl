import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppPillComponent } from './pill.component';

@Component({
  template: `
    <app-pill
      [label]="label()"
      [colour]="colour()"
      [size]="size()"
      [customClass]="customClass()"
    >
      Projected Pill
    </app-pill>
  `,
  imports: [AppPillComponent]
})
class TestHostComponent {
  label = signal('Active Status');
  colour = signal<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>('success');
  size = signal<'sm' | 'md'>('md');
  customClass = signal('');
}

describe('AppPillComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let pillElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppPillComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    pillElement = fixture.nativeElement.querySelector('span');
  });

  it('should create and render label when provided', () => {
    expect(pillElement).toBeTruthy();
    expect(pillElement.textContent?.trim()).toBe('Active Status');
  });

  it('should render projected content when label signal is empty', () => {
    host.label.set('');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Projected Pill');
  });

  it('should apply success colour and size md classes', () => {
    expect(pillElement.classList.contains('bg-emerald-500/20')).toBe(true);
    expect(pillElement.classList.contains('text-emerald-400')).toBe(true);
    expect(pillElement.classList.contains('ps-3')).toBe(true);
    expect(pillElement.classList.contains('pe-3')).toBe(true);
  });

  it('should update classes when colour is changed to primary and size to sm', () => {
    host.colour.set('primary');
    host.size.set('sm');
    host.customClass.set('pill-custom');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-primary/10')).toBe(true);
    expect(pillElement.classList.contains('ps-2.5')).toBe(true);
    expect(pillElement.classList.contains('pill-custom')).toBe(true);
  });
});
