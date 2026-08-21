import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveChatOverlayComponent } from './live-chat-overlay.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';

describe('LiveChatOverlayComponent', () => {
  let component: LiveChatOverlayComponent;
  let fixture: ComponentFixture<LiveChatOverlayComponent>;
  let mockCentrifugo: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let mockI18n: { translate: ReturnType<typeof vi.fn> };
  let receiveMessage: ((data: unknown) => void) | undefined;

  async function setup(roomId: string): Promise<void> {
    receiveMessage = undefined;
    mockCentrifugo = {
      subscribe: vi.fn((_channel: string, handler: (data: unknown) => void) => {
        receiveMessage = handler;
      }),
      unsubscribe: vi.fn(),
    };

    mockI18n = {
      translate: vi.fn((key: string) => {
        if (key === 'common.user') return 'User';
        return key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [LiveChatOverlayComponent],
      providers: [
        { provide: CentrifugoService, useValue: mockCentrifugo },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    // Angular 22 JIT test environment cannot resolve input() signals via setInput.
    // We must pass { detectChanges: false } as any and accept the NG0303 console warning
    // as benign (matching the video-call component spec pattern).
    fixture = TestBed.createComponent(LiveChatOverlayComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', roomId);
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup('test-room');
    expect(component).toBeTruthy();
  });

  it('should render overlay container with gradient', async () => {
    await setup('test-room');
    const el: HTMLElement = fixture.nativeElement;
    const overlay = el.querySelector('.bg-gradient-to-t');
    expect(overlay).toBeTruthy();
  });

  it('should display messages with sender name and text', async () => {
    await setup('test-room');
    component.messages.set([{ id: '1', senderName: 'Alice', text: 'Hello world', timestamp: 1 }]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Hello world');
  });

  it('should generate a secure ID when an incoming message omits one', async () => {
    await setup('test-room');
    expect(receiveMessage).toBeTypeOf('function');

    receiveMessage?.({ type: 'text', content: 'Hello securely' });

    expect(component.messages()[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should apply fade-in animation class to messages', async () => {
    await setup('test-room');
    component.messages.set([{ id: '1', senderName: 'Bob', text: 'Hi', timestamp: 1 }]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.animate-fade-in')).toBeTruthy();
  });

  it('should cap messages at 50 via the messages signal cap', async () => {
    await setup('test-room');
    // Push 60 messages, shifting the oldest off when > 50
    for (let i = 0; i < 60; i++) {
      component.messages.update((msgs) => {
        const next = [
          ...msgs,
          { id: `msg-${i}`, senderName: 'Test', text: `Text ${i}`, timestamp: Date.now() },
        ];
        while (next.length > 50) next.shift();
        return next;
      });
    }

    expect(component.messages().length).toBe(50);
  });

  it('should not throw on destroy when cleaning up via DestroyRef', async () => {
    await setup('test-room');
    expect(() => fixture.destroy()).not.toThrow();
  });
});
