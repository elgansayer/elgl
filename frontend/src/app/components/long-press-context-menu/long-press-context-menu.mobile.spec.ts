import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { NlpService } from '../../services/nlp.service';
import { LongPressContextMenuComponent } from './long-press-context-menu.component';

describe('LongPressContextMenuComponent mobile contract (#1822)', () => {
  let fixture: ComponentFixture<LongPressContextMenuComponent>;
  let component: LongPressContextMenuComponent;

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
    fixture.componentRef.setInput('messageId', 'message-1822');
    fixture.componentRef.setInput('messageContent', 'Hola');
    fixture.componentRef.setInput('messageType', 'text');
    fixture.componentRef.setInput('senderId', 'sender-1822');
    fixture.componentRef.setInput('roomId', 'room-1822');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the message action dialog after the mobile long-press threshold', () => {
    vi.useFakeTimers();

    component.onTouchStart({ touches: [{}] } as unknown as TouchEvent);
    vi.advanceTimersByTime(599);
    expect(component.menuVisible()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(component.menuVisible()).toBe(true);
  });

  it('cancels the pending mobile long press when the touch ends', () => {
    vi.useFakeTimers();

    component.onTouchStart({ touches: [{}] } as unknown as TouchEvent);
    component.onTouchEnd();
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
  });

  it('ignores multi-touch gestures instead of opening message actions', () => {
    vi.useFakeTimers();

    component.onTouchStart({ touches: [{}, {}] } as unknown as TouchEvent);
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
  });

  it('emits the exact copy payload and dismisses the dialog', () => {
    vi.spyOn(component.copyMessage, 'emit');
    component.menuVisible.set(true);

    component.doCopy();

    expect(component.copyMessage.emit).toHaveBeenCalledWith({
      messageId: 'message-1822',
      content: 'Hola',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('emits the exact favourite payload and dismisses the dialog', () => {
    vi.spyOn(component.favourite, 'emit');
    component.menuVisible.set(true);

    component.doFavourite();

    expect(component.favourite.emit).toHaveBeenCalledWith({
      messageId: 'message-1822',
      content: 'Hola',
      messageType: 'text',
    });
    expect(component.menuVisible()).toBe(false);
  });

  it('emits the exact report payload and dismisses the dialog', () => {
    vi.spyOn(component.report, 'emit');
    component.menuVisible.set(true);

    component.doReport();

    expect(component.report.emit).toHaveBeenCalledWith({
      messageId: 'message-1822',
      senderId: 'sender-1822',
    });
    expect(component.menuVisible()).toBe(false);
  });
});
