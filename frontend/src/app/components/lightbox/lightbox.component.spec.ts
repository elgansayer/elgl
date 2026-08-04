import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LightboxComponent } from './lightbox.component';

describe('LightboxComponent', () => {
  let component: LightboxComponent;
  let fixture: ComponentFixture<LightboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightboxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LightboxComponent);
    component = fixture.componentInstance;
  });

  function setup(images: string[], initialIndex = 0) {
    fixture.componentRef.setInput('images', images);
    fixture.componentRef.setInput('initialIndex', initialIndex);
    fixture.detectChanges();
  }

  it('should create the component', () => {
    setup(['a']);
    expect(component).toBeTruthy();
  });

  it('should set currentIndex from initialIndex during ngOnInit', () => {
    setup(['a', 'b', 'c'], 2);
    expect(component.currentIndex()).toBe(2);
  });

  it('should default currentIndex to 0 when initialIndex is not provided', () => {
    setup(['a', 'b']);
    expect(component.currentIndex()).toBe(0);
  });

  it('should increase currentIndex on next', () => {
    setup(['a', 'b', 'c'], 0);
    component.next();
    expect(component.currentIndex()).toBe(1);
  });

  it('should not exceed last index on next', () => {
    setup(['a', 'b'], 1);
    component.next();
    expect(component.currentIndex()).toBe(1);
  });

  it('should decrease currentIndex on prev', () => {
    setup(['a', 'b', 'c'], 2);
    component.prev();
    expect(component.currentIndex()).toBe(1);
  });

  it('should not go below zero on prev', () => {
    setup(['a', 'b'], 0);
    component.prev();
    expect(component.currentIndex()).toBe(0);
  });

  it('should goTo a specific index', () => {
    setup(['a', 'b', 'c'], 0);
    component.goTo(2);
    expect(component.currentIndex()).toBe(2);
  });

  it('should emit closed on Escape key', () => {
    setup(['a']);
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBeTrue();
  });

  it('should increase currentIndex on ArrowRight', () => {
    setup(['a', 'b', 'c'], 0);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.currentIndex()).toBe(1);
  });

  it('should decrease currentIndex on ArrowLeft', () => {
    setup(['a', 'b', 'c'], 1);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.currentIndex()).toBe(0);
  });

  it('should handle swipe left to go next', () => {
    setup(['a', 'b', 'c'], 0);

    const touchStartEvent = { changedTouches: [{ screenX: 200 }] } as unknown as TouchEvent;
    const touchEndEvent = { changedTouches: [{ screenX: 100 }] } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    component.onTouchEnd(touchEndEvent);
    expect(component.currentIndex()).toBe(1);
  });

  it('should handle swipe right to go prev', () => {
    setup(['a', 'b', 'c'], 1);

    const touchStartEvent = { changedTouches: [{ screenX: 100 }] } as unknown as TouchEvent;
    const touchEndEvent = { changedTouches: [{ screenX: 200 }] } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    component.onTouchEnd(touchEndEvent);
    expect(component.currentIndex()).toBe(0);
  });

  it('should stop propagation on next arrow click', () => {
    setup(['a', 'b'], 0);

    let propagated = false;
    const event = new Event('click', { bubbles: true });
    const originalStop = event.stopPropagation.bind(event);
    event.stopPropagation = () => {
      propagated = true;
      originalStop();
    };

    component.next(event);
    expect(propagated).toBeTrue();
    expect(component.currentIndex()).toBe(1);
  });
});
