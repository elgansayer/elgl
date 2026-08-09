import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppSkeletonLoaderComponent } from './skeleton-loader.component';

describe('AppSkeletonLoaderComponent', () => {
  let fixture: ComponentFixture<AppSkeletonLoaderComponent>;
  let component: AppSkeletonLoaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSkeletonLoaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppSkeletonLoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default signal values', () => {
    expect(component.height()).toBe('16px');
    expect(component.width()).toBe('100%');
    expect(component.borderRadius()).toBe('8px');
    expect(component.variant()).toBe('rect');
    expect(component.customClass()).toBe('');
  });

  it('should have aria-hidden and role=presentation on host', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBe('presentation');
  });

  it('should apply shimmer animation class and bg-surface-100', () => {
    const classes = component.hostClasses();
    expect(classes).toContain('skeleton-shimmer');
    expect(classes).toContain('bg-surface-100');
  });
});
