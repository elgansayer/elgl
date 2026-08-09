import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppEmptyStateComponent } from './empty-state.component';

describe('AppEmptyStateComponent', () => {
  let fixture: ComponentFixture<AppEmptyStateComponent>;
  let component: AppEmptyStateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppEmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppEmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and compute ariaLabel fallback', () => {
    expect(component).toBeTruthy();
    const hostEl = fixture.nativeElement as HTMLElement;
    expect(hostEl.getAttribute('role')).toBe('region');
    expect(component.ariaLabelAttribute()).toBe('Empty state');
  });

  it('should have default input signal values', () => {
    expect(component.icon()).toBe('📭');
    expect(component.title()).toBe('');
    expect(component.description()).toBe('');
    expect(component.actionLabel()).toBe('');
    expect(component.illustration()).toBe('');
  });

  it('should emit actionClicked when onAction is called', () => {
    let emitted = false;
    component.actionClicked.subscribe(() => (emitted = true));
    component.onAction();
    expect(emitted).toBe(true);
  });
});
