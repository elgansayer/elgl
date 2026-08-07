import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi } from 'vitest';
import { LiveChatOverlayComponent } from './live-chat-overlay.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';

describe('LiveChatOverlayComponent', () => {
  let component: LiveChatOverlayComponent;
  let fixture: ComponentFixture<LiveChatOverlayComponent>;
  let centrifugoMock: {
    subscribeLiveRoom: ReturnType<typeof vi.fn>;
    unsubscribeLiveRoom: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
  };
  let liveRoomCallback: ((data: unknown) => void) | null = null;

  it('should create and display messages properly', async () => {
    liveRoomCallback = null;
    centrifugoMock = {
      subscribeLiveRoom: vi.fn((_roomId: string, cb: (data: unknown) => void) => {
        liveRoomCallback = cb;
      }),
      unsubscribeLiveRoom: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    };

    const i18nMock = {
      translate: (key: string) => key,
    };

    await TestBed.configureTestingModule({
      imports: [LiveChatOverlayComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CentrifugoService, useValue: centrifugoMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LiveChatOverlayComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'test-room-1');
    fixture.detectChanges();

    // Test 1: should create
    expect(component).toBeTruthy();

    // Test 2: should subscribe on init
    expect(centrifugoMock.subscribeLiveRoom).toHaveBeenCalledWith(
      'test-room-1',
      expect.any(Function),
    );

    // Test 3: should render overlay container
    const compiled = fixture.nativeElement as HTMLElement;
    const overlay = compiled.querySelector('.absolute.bottom-0');
    expect(overlay).toBeTruthy();

    // Test 4: should display incoming messages
    liveRoomCallback!({
      type: 'text',
      content: 'Hello world!',
      sender_id: 'user-abc',
      id: 'msg-001',
    });
    fixture.detectChanges();
    const messageElements = compiled.querySelectorAll('.animate-fade-in');
    expect(messageElements.length).toBe(1);
    expect(compiled.textContent).toContain('Hello world!');
    expect(compiled.textContent).toContain('user-abc');

    // Test 5: should cap messages at 50
    for (let i = 0; i < 55; i++) {
      liveRoomCallback!({
        type: 'text',
        content: `Message ${i}`,
        sender_id: `user-${i}`,
        id: `msg-${i}`,
      });
    }
    fixture.detectChanges();
    expect(component.messages().length).toBe(50);
    expect(component.messages()[0].text).toBe('Message 5');
    expect(component.messages()[49].text).toBe('Message 54');

    // Test 6: should ignore non-text messages
    const lenBefore = component.messages().length;
    liveRoomCallback!({ type: 'voice', content: 'should not show', id: 'v-1' });
    liveRoomCallback!({ type: 'gift', content: 'should not show', id: 'g-1' });
    fixture.detectChanges();
    expect(component.messages().length).toBe(lenBefore);

    // Test 7: should unsubscribe on destroy
    fixture.destroy();
    expect(centrifugoMock.unsubscribeLiveRoom).toHaveBeenCalledWith('test-room-1');
  });
});