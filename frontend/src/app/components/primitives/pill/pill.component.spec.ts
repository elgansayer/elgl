import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppPillComponent } from './pill.component';

@Component({
  template: `
    <app-pill [label]="label()" [colour]="colour()" [size]="size()" [customClass]="customClass()">
      Projected Pill
    </app-pill>
  `,
  imports: [AppPillComponent],
})
class TestHostComponent {
  label = signal('');
  colour = signal<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>('success');
  size = signal<'sm' | 'md'>('md');
  customClass = signal('');
}

describe('AppPillComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let pillHostElement: HTMLElement;
  let pillElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppPillComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    pillHostElement = fixture.nativeElement.querySelector('app-pill') as HTMLElement;
    pillElement = fixture.nativeElement.querySelector('app-pill span') as HTMLElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render label when provided', () => {
    host.label.set('Active Status');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Active Status');
  });

  it('should render projected content when label signal is empty', () => {
    host.label.set('');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Projected Pill');
  });

  it('should not render projected content when label is set', () => {
    host.label.set('Active Status');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Active Status');
    expect(pillElement.textContent?.includes('Projected Pill')).toBe(false);
  });

  it('should apply host inline-block class', () => {
    expect(pillHostElement.classList.contains('inline-block')).toBe(true);
  });

  it('should apply base pill classes', () => {
    expect(pillElement.classList.contains('inline-flex')).toBe(true);
    expect(pillElement.classList.contains('items-center')).toBe(true);
    expect(pillElement.classList.contains('justify-center')).toBe(true);
    expect(pillElement.classList.contains('font-extrabold')).toBe(true);
    expect(pillElement.classList.contains('rounded-pill')).toBe(true);
  });

  it('should apply success colour (token-driven, not i18n-smuggled) and md logical size classes', () => {
    host.colour.set('success');
    host.size.set('md');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-success')).toBe(true);
    expect(pillElement.classList.contains('text-on-fill')).toBe(true);
    expect(pillElement.classList.contains('ps-3')).toBe(true);
    expect(pillElement.classList.contains('pe-3')).toBe(true);
    expect(pillElement.classList.contains('py-1')).toBe(true);
    expect(pillElement.classList.contains('text-sm')).toBe(true);
  });

  it('should update classes when colour is changed to primary and size to sm', () => {
    host.colour.set('primary');
    host.size.set('sm');
    host.customClass.set('pill-custom');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-primary')).toBe(true);
    expect(pillElement.classList.contains('text-on-fill')).toBe(true);
    expect(pillElement.classList.contains('ps-2')).toBe(true);
    expect(pillElement.classList.contains('pe-2')).toBe(true);
    expect(pillElement.classList.contains('py-0.5')).toBe(true);
    expect(pillElement.classList.contains('text-xs')).toBe(true);
    expect(pillElement.classList.contains('pill-custom')).toBe(true);
  });

  it('should apply warning colour classes', () => {
    host.colour.set('warning');
    fixture.detectChanges();
    expect(pillElement.classList.contains('bg-warning')).toBe(true);
    expect(pillElement.classList.contains('text-on-fill')).toBe(true);
  });

  it('should apply danger colour classes', () => {
    host.colour.set('danger');
    fixture.detectChanges();
    expect(pillElement.classList.contains('bg-danger')).toBe(true);
    expect(pillElement.classList.contains('text-on-fill')).toBe(true);
  });

  it('should apply info colour classes using the secondary (Tide) token', () => {
    host.colour.set('info');
    fixture.detectChanges();
    expect(pillElement.classList.contains('bg-secondary')).toBe(true);
    expect(pillElement.classList.contains('text-on-fill')).toBe(true);
  });

  it('should use default neutral colour and md size classes when no inputs are provided', () => {
    host.label.set('');
    host.colour.set('neutral');
    host.size.set('md');
    host.customClass.set('');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-surface-100')).toBe(true);
    expect(pillElement.classList.contains('text-text-primary')).toBe(true);
    expect(pillElement.classList.contains('ps-3')).toBe(true);
    expect(pillElement.classList.contains('pe-3')).toBe(true);
  });

  it('should have non-empty trimmed class list for any state', () => {
    host.label.set('Status');
    host.colour.set('neutral');
    host.size.set('sm');
    host.customClass.set('');
    fixture.detectChanges();

    const classString = pillElement.getAttribute('class');
    expect(classString?.split(' ').filter(Boolean).length).toBeGreaterThan(0);
  });
});
