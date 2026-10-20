import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { NlpService } from '../../services/nlp.service';
import { LongPressContextMenuComponent } from './long-press-context-menu.component';

function makeTouchList(points: Array<{ x: number; y: number }>): TouchList {
  const touches = points.map(
    (point) => ({ clientX: point.x, clientY: point.y }) as unknown as Touch,
  );
  return {
    length: touches.length,
    item: (index: number) => touches[index] ?? null,
  } as unknown as TouchList;
}

function makeTouchEvent(options: {
  touches?: Array<{ x: number; y: number }>;
  changedTouches?: Array<{ x: number; y: number }>;
  cancelable?: boolean;
}): TouchEvent {
  return {
    touches: makeTouchList(options.touches ?? []),
    changedTouches: makeTouchList(options.changedTouches ?? []),
    cancelable: options.cancelable ?? true,
    preventDefault: vi.fn(),
  } as unknown as TouchEvent;
}

describe('LongPressContextMenuComponent swipe-to-reply', () => {
  let component: LongPressContextMenuComponent;
  let fixture: ComponentFixture<LongPressContextMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LongPressContextMenuComponent],
      providers: [
        I18nService,
        {
          provide: NlpService,
          useValue: {
            explainGrammar: vi.fn(),
            simplifyText: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LongPressContextMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('messageId', 'message-1161');
    fixture.componentRef.setInput('messageContent', 'Reply to this message');
    fixture.componentRef.setInput('messageType', 'text');
    fixture.componentRef.setInput('senderId', 'sender-1');
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits reply for a deliberate horizontal swipe', () => {
    const emit = vi.spyOn(component.reply, 'emit');
    const end = makeTouchEvent({ changedTouches: [{ x: 72, y: 8 }] });

    component.onTouchStart(makeTouchEvent({ touches: [{ x: 0, y: 0 }] }));
    component.onTouchMove(makeTouchEvent({ touches: [{ x: 30, y: 4 }] }));
    component.onTouchEnd(end);

    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith({ messageId: 'message-1161' });
    expect(end.preventDefault).toHaveBeenCalledOnce();
  });

  it('supports the opposite horizontal direction for RTL layouts', () => {
    const emit = vi.spyOn(component.reply, 'emit');

    component.onTouchStart(makeTouchEvent({ touches: [{ x: 90, y: 10 }] }));
    component.onTouchMove(makeTouchEvent({ touches: [{ x: 45, y: 12 }] }));
    component.onTouchEnd(makeTouchEvent({ changedTouches: [{ x: 20, y: 14 }] }));

    expect(emit).toHaveBeenCalledWith({ messageId: 'message-1161' });
  });

  it('does not reply for a short horizontal gesture', () => {
    const emit = vi.spyOn(component.reply, 'emit');

    component.onTouchStart(makeTouchEvent({ touches: [{ x: 10, y: 10 }] }));
    component.onTouchMove(makeTouchEvent({ touches: [{ x: 35, y: 12 }] }));
    component.onTouchEnd(makeTouchEvent({ changedTouches: [{ x: 45, y: 12 }] }));

    expect(emit).not.toHaveBeenCalled();
  });

  it('leaves vertical scrolling alone instead of treating it as a reply gesture', () => {
    const emit = vi.spyOn(component.reply, 'emit');

    component.onTouchStart(makeTouchEvent({ touches: [{ x: 10, y: 10 }] }));
    component.onTouchMove(makeTouchEvent({ touches: [{ x: 18, y: 70 }] }));
    component.onTouchEnd(makeTouchEvent({ changedTouches: [{ x: 90, y: 90 }] }));

    expect(emit).not.toHaveBeenCalled();
  });

  it('cancels long-press menu activation as soon as a swipe starts moving', () => {
    vi.useFakeTimers();

    component.onTouchStart(makeTouchEvent({ touches: [{ x: 0, y: 0 }] }));
    component.onTouchMove(makeTouchEvent({ touches: [{ x: 20, y: 1 }] }));
    vi.advanceTimersByTime(700);

    expect(component.menuVisible()).toBe(false);
  });

  it('clears an interrupted gesture on touchcancel', () => {
    const emit = vi.spyOn(component.reply, 'emit');

    component.onTouchStart(makeTouchEvent({ touches: [{ x: 0, y: 0 }] }));
    component.onTouchCancel();
    component.onTouchEnd(makeTouchEvent({ changedTouches: [{ x: 100, y: 0 }] }));

    expect(emit).not.toHaveBeenCalled();
  });
});
