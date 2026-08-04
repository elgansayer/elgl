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

  it('should have menu hidden initially', () => {
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit reply and close the menu when doReply is called', () => {
    vi.spyOn(component.reply, 'emit');
    component.menuVisible.set(true);

    component.doReply();

    expect(component.reply.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
    });
    expect(component.menuVisible()).toBe(false);
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

  it('should emit translate and close the menu when doTranslate is called', () => {
    vi.spyOn(component.translate, 'emit');
    component.menuVisible.set(true);

    component.doTranslate();

    expect(component.translate.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit transliterate and close the menu when doTransliterate is called', () => {
    vi.spyOn(component.transliterate, 'emit');
    component.menuVisible.set(true);

    component.doTransliterate();

    expect(component.transliterate.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit speak and close the menu when doSpeak is called', () => {
    vi.spyOn(component.speak, 'emit');
    component.menuVisible.set(true);

    component.doSpeak();

    expect(component.speak.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should emit correct and close the menu when doCorrect is called', () => {
    vi.spyOn(component.correct, 'emit');
    component.menuVisible.set(true);

    component.doCorrect();

    expect(component.correct.emit).toHaveBeenCalledWith({
      messageId: 'test-message-id',
      content: 'Hello world',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should not render translate, transliterate, speak, or correct actions for non-text messages', () => {
    fixture.componentRef.setInput('messageType', 'voice');
    component.menuVisible.set(true);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    expect(buttons.length).toBe(6);
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
    expect(buttons.length).toBe(10);
  });

  it('should emit block toggled to false when the sender is already blocked', () => {
    vi.spyOn(component.block, 'emit');
    fixture.componentRef.setInput('isBlocked', true);
    component.menuVisible.set(true);

    component.doBlockToggle();

    expect(component.block.emit).toHaveBeenCalledWith({
      senderId: 'user-123',
      blocked: false,
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('should open the menu after a long touch press', () => {
    vi.useFakeTimers();

    const touchStartEvent = {
      touches: [{ identifier: 0 }],
    } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    expect(component.menuVisible()).toBe(false);

    vi.advanceTimersByTime(600);
    expect(component.menuVisible()).toBe(true);

    vi.useRealTimers();
  });

  it('should not open the menu on multiple-touch start', () => {
    vi.useFakeTimers();

    const multiTouchEvent = {
      touches: [{ identifier: 0 }, { identifier: 1 }],
    } as unknown as TouchEvent;
    component.onTouchStart(multiTouchEvent);
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
    vi.useRealTimers();
  });

  it('should not open the menu if touch is released before the long press threshold', () => {
    vi.useFakeTimers();

    const touchStartEvent = {
      touches: [{ identifier: 0 }],
    } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    component.onTouchEnd();
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
    vi.useRealTimers();
  });

  it('should not open the menu if touch is cancelled before the long press threshold', () => {
    vi.useFakeTimers();

    const touchStartEvent = {
      touches: [{ identifier: 0 }],
    } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    component.onTouchCancel();
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
    vi.useRealTimers();
  });

  it('should cancel the menu timer when the mouse leaves before the long press threshold', () => {
    vi.useFakeTimers();

    component.onMouseDown(new MouseEvent('mousedown', { button: 0 }));
    component.onMouseCancel();
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
    vi.useRealTimers();
  });
});
