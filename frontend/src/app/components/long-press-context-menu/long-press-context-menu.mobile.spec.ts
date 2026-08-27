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

  it('cancels the pending long press when a touch gesture turns into a drag or scroll', () => {
    vi.useFakeTimers();
    component.onTouchStart({ touches: [{}] } as unknown as TouchEvent);

    const touchSurface = fixture.nativeElement.querySelector('div') as HTMLElement;
    expect(touchSurface).toBeTruthy();
    touchSurface.dispatchEvent(new Event('touchmove', { bubbles: true }));
    vi.advanceTimersByTime(600);

    expect(component.menuVisible()).toBe(false);
  });
});
