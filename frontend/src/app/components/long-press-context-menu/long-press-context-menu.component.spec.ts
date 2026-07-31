import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LongPressContextMenuComponent } from './long-press-context-menu.component';
import { I18nService } from '../../services/i18n.service';

describe('LongPressContextMenuComponent', () => {
  let component: LongPressContextMenuComponent;
  let fixture: ComponentFixture<LongPressContextMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LongPressContextMenuComponent],
      providers: [I18nService],
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

  it('should emit copyMessage and close the menu when doCopy is called', () => {
    vi.spyOn(component.copyMessage, 'emit');
    component.menuVisible.set(true);

    component.doCopy();

    expect(component.copyMessage.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit favourite and close the menu when doFavourite is called', () => {
    vi.spyOn(component.favourite, 'emit');
    component.menuVisible.set(true);

    component.doFavourite();

    expect(component.favourite.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
      messageType: 'text',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit report and close the menu when doReport is called', () => {
    vi.spyOn(component.report, 'emit');
    component.menuVisible.set(true);

    component.doReport();

    expect(component.report.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      senderId: 'user-123',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit block toggled to true when the sender is not yet blocked', () => {
    vi.spyOn(component.block, 'emit');
    component.menuVisible.set(true);

    component.doBlockToggle();

    expect(component.block.emit).toHaveBeenCalledWith({
      senderId: 'user-123',
      blocked: true,
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should open the menu after a long mouse press', () => {
    vi.useFakeTimers();

    component.onMouseDown(new MouseEvent('mousedown', { button: 0 }));
    expect(component.menuVisible()).toBe(false);

    vi.advanceTimersByTime(600);
    expect(component.menuVisible()).toBe(true);

    vi.useRealTimers();
  });

  it('should not open the menu if the mouse is released before the long press threshold', () => {
    vi.useFakeTimers();

    component.onMouseDown(new MouseEvent('mousedown', { button: 0 }));
    component.onMouseUp();
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
    vi.useRealTimers();
  });

  it('should ignore mouse down events from buttons other than the primary button', () => {
    vi.useFakeTimers();

    component.onMouseDown(new MouseEvent('mousedown', { button: 1 }));
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
    vi.useRealTimers();
  });

  it('should close the menu when closeMenu is called', () => {
    component.menuVisible.set(true);
    component.closeMenu();
    expect(component.menuVisible()).toBe(false);
  });

  it('should render menu options once the menu is visible', () => {
    component.menuVisible.set(true);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    expect(buttons.length).toBe(5);
  });
});
