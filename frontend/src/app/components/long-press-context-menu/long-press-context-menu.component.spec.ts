import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LongPressContextMenuComponent } from './long-press-context-menu.component';

(globalThis as any).Touch = class Touch {};
(globalThis as any).TouchEvent = class TouchEvent extends Event {};

describe('LongPressContextMenuComponent', () => {
  let component: LongPressContextMenuComponent;
  let fixture: ComponentFixture<LongPressContextMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LongPressContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LongPressContextMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('messageId', 'test-message-id');
    fixture.componentRef.setInput('messageContent', 'Hello world');
    fixture.componentRef.setInput('messageType', 'text');
    fixture.componentRef.setInput('senderId', 'user-123');
    fixture.componentRef.setInput('roomId', 'room-456');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit copy event when copy option is clicked', () => {
    vi.spyOn(component.copy, 'emit');
    component['onOptionClick']('copy');
    expect(component.copy.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
    });
  });

  it('should emit favourite event when favourite option is clicked', () => {
    vi.spyOn(component.favourite, 'emit');
    component['onOptionClick']('favourite');
    expect(component.favourite.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
      messageType: 'text',
    });
  });

  it('should emit report event when report option is clicked', () => {
    vi.spyOn(component.report, 'emit');
    component['onOptionClick']('report');
    expect(component.report.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
      senderId: 'user-123',
      roomId: 'room-456',
    });
  });

  it('should close menu after option click', () => {
    vi.spyOn(component as any, 'close');
    component['onOptionClick']('copy');
    expect((component as any).close).toHaveBeenCalled();
  });

  it('should open menu on right click', () => {
    const event = new MouseEvent('contextmenu', { clientX: 100, clientY: 200 });
    vi.spyOn(event, 'preventDefault');
    component.onRightClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.showMenu()).toBe(true);
    expect(component.position()).toEqual({ x: 100, y: 200 });
  });

  it('should close menu on document click outside', () => {
    component['showMenu'].set(true);
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    outsideElement.click();
    expect(component.showMenu()).toBe(false);
    document.body.removeChild(outsideElement);
  });

  it('should close menu on escape key', () => {
    component['showMenu'].set(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    expect(component.showMenu()).toBe(false);
  });

  it('should close menu on window resize', () => {
    component['showMenu'].set(true);
    window.dispatchEvent(new Event('resize'));
    expect(component.showMenu()).toBe(false);
  });

  it('should close menu on window scroll', () => {
    component['showMenu'].set(true);
    window.dispatchEvent(new Event('scroll'));
    expect(component.showMenu()).toBe(false);
  });

  it('should not open menu when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const event = new MouseEvent('contextmenu', { clientX: 100, clientY: 200 });
    component.onRightClick(event);
    expect(component.showMenu()).toBe(false);
  });

  it('should start long press timer on touch start', () => {
    vi.useFakeTimers();
    const touchEvent = {
      type: 'touchstart',
      touches: [{ clientX: 0, clientY: 0 }],
      preventDefault: vi.fn()
    } as any;
    component.onTouchStart(touchEvent);
    expect((component as any).longPressTimer).not.toBeNull();
    vi.advanceTimersByTime(component.longPressDuration());
    expect(component.showMenu()).toBe(true);
    vi.useRealTimers();
  });

  it('should cancel long press on touch move', () => {
    const touchEvent = {
      type: 'touchstart',
      touches: [{ clientX: 0, clientY: 0 }],
      preventDefault: vi.fn()
    } as any;
    component.onTouchStart(touchEvent);
    component.onTouchMove();
    expect((component as any).longPressTimer).toBeNull();
  });

  it('should cancel long press on touch end', () => {
    const touchEvent = {
      type: 'touchstart',
      touches: [{ clientX: 0, clientY: 0 }],
      preventDefault: vi.fn()
    } as any;
    component.onTouchStart(touchEvent);
    component.onTouchEnd();
    expect((component as any).longPressTimer).toBeNull();
  });

  it('should render menu options', () => {
    component['showMenu'].set(true);
    fixture.detectChanges();
    const buttons = fixture.debugElement.queryAll(By.css('button[role="menuitem"]'));
    expect(buttons.length).toBe(3);
    expect(buttons[0].nativeElement.textContent).toContain('Copy');
    expect(buttons[1].nativeElement.textContent).toContain('Favourite');
    expect(buttons[2].nativeElement.textContent).toContain('Report');
  });

  it.skip('should disable menu options when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    component['showMenu'].set(true);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[role="menuitem"]'));
    buttons.forEach(btn => {
      expect(btn.nativeElement.disabled).toBe(true);
    });
  });
});
