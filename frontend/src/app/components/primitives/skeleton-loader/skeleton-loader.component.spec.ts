import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppSkeletonLoaderComponent } from './skeleton-loader.component';

@Component({
  template: `
    <app-skeleton-loader
      [height]="h()"
      [width]="w()"
      [borderRadius]="br()"
      [variant]="v()"
      [customClass]="cc()"
    />
  `,
  imports: [AppSkeletonLoaderComponent],
})
class TestHostComponent {
  h = signal('20px');
  w = signal('80%');
  br = signal('4px');
  v = signal<'text' | 'circle' | 'rect'>('rect');
  cc = signal('');
}

describe('AppSkeletonLoaderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let skeletonEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppSkeletonLoaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    skeletonEl = fixture.nativeElement.querySelector('app-skeleton-loader');
  });

  it('should create', () => {
    expect(skeletonEl).toBeTruthy();
  });

  it('should render with correct dimensions', () => {
    expect(skeletonEl.style.height).toBe('20px');
    expect(skeletonEl.style.width).toBe('80%');
    expect(skeletonEl.style.borderRadius).toBe('4px');
  });

  it('should have aria-hidden and role=presentation', () => {
    expect(skeletonEl.getAttribute('aria-hidden')).toBe('true');
    expect(skeletonEl.getAttribute('role')).toBe('presentation');
  });

  it('should apply pulse animation class', () => {
    expect(skeletonEl.classList.contains('animate-pulse')).toBe(true);
    expect(skeletonEl.classList.contains('bg-surface-100')).toBe(true);
  });

  it('should apply circle variant class', () => {
    host.v.set('circle');
    fixture.detectChanges();
    expect(skeletonEl.classList.contains('rounded-full')).toBe(true);
  });

  it('should apply text variant class', () => {
    host.v.set('text');
    fixture.detectChanges();
    expect(skeletonEl.classList.contains('rounded')).toBe(true);
  });

  it('should apply custom class', () => {
    host.cc.set('mt-2 mb-2');
    fixture.detectChanges();
    expect(skeletonEl.classList.contains('mt-2')).toBe(true);
    expect(skeletonEl.classList.contains('mb-2')).toBe(true);
  });

  it('should update dimensions reactively', () => {
    host.h.set('32px');
    host.w.set('60%');
    host.br.set('12px');
    fixture.detectChanges();
    expect(skeletonEl.style.height).toBe('32px');
    expect(skeletonEl.style.width).toBe('60%');
    expect(skeletonEl.style.borderRadius).toBe('12px');
  });
});