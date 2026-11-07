import { Component, WritableSignal, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AudioRoomRecord,
  AudioRoomsStore,
  RoomChatMessage,
  RoomChatMessagePage,
} from '../../services/audio-rooms.store';
import { CentrifugeService } from '../../services/centrifuge.service';
import { I18nService } from '../../services/i18n.service';
import { SoundboardComponent } from '../soundboard/soundboard.component';
import { RoomChatComponent } from './room-chat.component';

@Component({ selector: 'app-soundboard', template: '' })
class MockSoundboardComponent {
  readonly roomId = input('');
  readonly hostUserId = input('');
  readonly coHostUserId = input('');
}

const room: AudioRoomRecord = {
  id: '4d72ae50-6153-4c54-a638-334fe24ab7e2',
  room_name: 'english-practice',
  title: 'English practice',
  target_language: 'en',
  host_id: 'user-1',
  is_active: true,
  speakers: ['user-1'],
  raised_hands: [],
  listeners_count: 1,
  created_at: '2026-11-03T09:00:00.000Z',
};

const message: RoomChatMessage = {
  id: 'd1a28d8e-81c4-4ea1-aaf2-f53bcedb1871',
  room_id: room.id,
  sender_id: 'user-2',
  sender_name: 'مريم',
  client_message_id: 'ef0cf713-4643-4fc7-8f5e-eddbd3344c91',
  text_content: 'شكراً جزيلاً',
  created_at: '2026-11-03T10:00:00.000Z',
};

function page(messages: RoomChatMessage[] = []): RoomChatMessagePage {
  return { messages, limit: 50, offset: 0, has_more: false };
}

describe('RoomChatComponent', () => {
  let fixture: ComponentFixture<RoomChatComponent>;
  let component: RoomChatComponent;
  let store: {
    currentRoom: ReturnType<typeof signal<AudioRoomRecord | null>>;
    isConnectedToLiveKit: ReturnType<typeof signal<boolean>>;
    isSpeaker: ReturnType<typeof signal<boolean>>;
    captions: ReturnType<typeof signal<never[]>>;
    roomMessages: ReturnType<typeof signal<RoomChatMessage[]>>;
    roomChatRecoveryFailed: ReturnType<typeof signal<boolean>>;
    getRoomChatMessages: ReturnType<typeof vi.fn>;
    sendRoomChatMessage: ReturnType<typeof vi.fn>;
    recoverRoomChatMessages: ReturnType<typeof vi.fn>;
    sendCaption: ReturnType<typeof vi.fn>;
    broadcastAICaption: ReturnType<typeof vi.fn>;
  };
  let connectionStatus: WritableSignal<string>;

  beforeEach(async () => {
    connectionStatus = signal('connected');
    store = {
      currentRoom: signal<AudioRoomRecord | null>(room),
      isConnectedToLiveKit: signal(true),
      isSpeaker: signal(false),
      captions: signal([]),
      roomMessages: signal<RoomChatMessage[]>([]),
      roomChatRecoveryFailed: signal(false),
      getRoomChatMessages: vi.fn().mockResolvedValue(page([message])),
      sendRoomChatMessage: vi.fn().mockResolvedValue(message),
      recoverRoomChatMessages: vi.fn().mockResolvedValue(undefined),
      sendCaption: vi.fn().mockResolvedValue(undefined),
      broadcastAICaption: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [RoomChatComponent],
      providers: [
        { provide: AudioRoomsStore, useValue: store },
        { provide: CentrifugeService, useValue: { connectionStatus } },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
          },
        },
      ],
    });
    TestBed.overrideComponent(RoomChatComponent, {
      remove: { imports: [SoundboardComponent] },
      add: { imports: [MockSoundboardComponent] },
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(RoomChatComponent);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads bounded recovery history and renders an accessible RTL-safe log', async () => {
    await render();

    expect(store.getRoomChatMessages).toHaveBeenCalledWith(room.id, 50, 0);
    const log = fixture.nativeElement.querySelector('[role="log"]');
    expect(log).toBeTruthy();
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(fixture.nativeElement.textContent).toContain(message.sender_name);
    expect(fixture.nativeElement.textContent).toContain(message.text_content);
    expect(fixture.nativeElement.querySelectorAll('[dir="auto"]').length).toBeGreaterThanOrEqual(2);
  });

  it('labels the chat composer without relying on a fake placeholder', async () => {
    await render();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#live-room-message');
    const label = fixture.nativeElement.querySelector('label[for="live-room-message"]');
    expect(input.hasAttribute('placeholder')).toBe(false);
    expect(label?.textContent).toContain('rooms.roomChat.inputLabel');
  });

  it('labels the subtitle composer without relying on a fake placeholder', async () => {
    store.isSpeaker.set(true);
    component.activeTab.set('subtitles');
    await render();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#live-room-caption');
    const label = fixture.nativeElement.querySelector('label[for="live-room-caption"]');
    expect(input.hasAttribute('placeholder')).toBe(false);
    expect(label?.textContent).toContain('rooms.roomChat.captionLabel');
  });

  it('deduplicates the HTTP response and realtime copy by persisted message ID', async () => {
    store.roomMessages.set([message]);
    await render();

    expect(component.messages()).toEqual([message]);
    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(1);
  });

  it('keeps the draft and retry key when delivery fails, then clears both after retry', async () => {
    store.sendRoomChatMessage.mockRejectedValueOnce(new Error('delivery unavailable'));
    await render();
    component.inputText.set('  Please repeat that  ');

    await component.send();
    const firstId = store.sendRoomChatMessage.mock.calls[0]?.[1];
    expect(firstId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(component.inputText()).toBe('  Please repeat that  ');
    expect(component.sendError()).toBe(true);

    await component.send();
    expect(store.sendRoomChatMessage.mock.calls[1]?.[1]).toBe(firstId);
    expect(component.inputText()).toBe('');
    expect(component.sendError()).toBe(false);
  });

  it('keeps the composer focusable while sending and returns focus to it afterwards', async () => {
    let finishSend: (sent: RoomChatMessage) => void = () => undefined;
    store.sendRoomChatMessage.mockReturnValueOnce(
      new Promise<RoomChatMessage>((resolve) => {
        finishSend = resolve;
      }),
    );
    await render();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#live-room-message');
    const sendButton: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-busy]');
    component.inputText.set('Hello everyone');
    fixture.detectChanges();
    sendButton.focus();

    const pending = component.send();
    fixture.detectChanges();

    // Read-only locks the draft without the focus loss a disabled input causes.
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(true);
    expect(sendButton.disabled).toBe(true);
    expect(sendButton.getAttribute('aria-busy')).toBe('true');

    finishSend(message);
    await pending;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input.readOnly).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('returns focus to the composer after a failed send so the kept draft can be retried', async () => {
    store.sendRoomChatMessage.mockRejectedValueOnce(new Error('delivery unavailable'));
    await render();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#live-room-message');
    component.inputText.set('Please repeat that');
    fixture.detectChanges();

    await component.send();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.sendError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(input.value).toBe('Please repeat that');
    expect(document.activeElement).toBe(input);
  });

  it('disables chat and avoids history requests until the room join succeeds', async () => {
    store.isConnectedToLiveKit.set(false);
    await render();

    expect(store.getRoomChatMessages).not.toHaveBeenCalled();
    const input = fixture.nativeElement.querySelector('#live-room-message');
    expect(input.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('rooms.roomChat.unavailable');
  });

  it('surfaces a retryable history failure without disabling realtime state', async () => {
    store.getRoomChatMessages.mockRejectedValueOnce(new Error('offline'));
    store.roomMessages.set([message]);
    await render();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(message.text_content);

    store.getRoomChatMessages.mockResolvedValueOnce(page([message]));
    component.retryHistory();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(store.getRoomChatMessages).toHaveBeenCalledTimes(2);
    expect(component.messages()).toEqual([message]);
  });

  it('replaces the empty state with the retry alert when history fails', async () => {
    store.getRoomChatMessages.mockRejectedValueOnce(new Error('offline'));
    await render();

    const log = fixture.nativeElement.querySelector('[role="log"]');
    expect(log.textContent).not.toContain('rooms.roomChat.emptyChat');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('keeps the newest message in view while the participant follows the tail', async () => {
    await render();

    const log = fixture.nativeElement.querySelector('[role="log"]') as HTMLDivElement;
    stubScrollMetrics(log, { scrollHeight: 800, clientHeight: 200 });
    log.scrollTop = 600;

    component.onLogScroll();
    store.roomMessages.set([message]);
    await render();

    expect(log.scrollTop).toBe(800);
  });

  it('leaves the reading position alone when the participant scrolls back', async () => {
    await render();

    const log = fixture.nativeElement.querySelector('[role="log"]') as HTMLDivElement;
    stubScrollMetrics(log, { scrollHeight: 800, clientHeight: 200 });
    log.scrollTop = 0;

    component.onLogScroll();
    store.roomMessages.set([message]);
    await render();

    expect(log.scrollTop).toBe(0);
  });

  it('starts at the newest message when the participant returns from the subtitles tab', async () => {
    store.roomMessages.set([message]);
    await render();
    const firstLog = fixture.nativeElement.querySelector('[role="log"]') as HTMLDivElement;
    stubScrollMetrics(firstLog, { scrollHeight: 800, clientHeight: 200 });
    firstLog.scrollTop = 0;
    component.onLogScroll();

    component.toggleTab();
    await render();
    expect(fixture.nativeElement.querySelector('[role="log"]')).toBeNull();

    const restoreMetrics = stubScrollMetricsForNewElements({
      scrollHeight: 800,
      clientHeight: 200,
    });
    try {
      component.toggleTab();
      await render();

      const reopened = fixture.nativeElement.querySelector('[role="log"]') as HTMLDivElement;
      expect(reopened).not.toBe(firstLog);
      expect(reopened.scrollTop).toBe(800);
    } finally {
      restoreMetrics();
    }
  });

  it('re-reads the newest messages once the connection returns after an interruption', async () => {
    await render();
    expect(store.recoverRoomChatMessages).not.toHaveBeenCalled();

    connectionStatus.set('reconnecting');
    await render();
    expect(store.recoverRoomChatMessages).not.toHaveBeenCalled();

    connectionStatus.set('connected');
    await render();
    expect(store.recoverRoomChatMessages).toHaveBeenCalledTimes(1);

    // A steady connection does not trigger another read.
    await render();
    expect(store.recoverRoomChatMessages).toHaveBeenCalledTimes(1);
  });

  it('leaves the first connection to the history load', async () => {
    connectionStatus.set('connecting');
    await render();

    connectionStatus.set('connected');
    await render();

    expect(store.recoverRoomChatMessages).not.toHaveBeenCalled();
  });

  it('keeps the messages and offers a retry when recovery after a reconnect fails', async () => {
    store.roomMessages.set([message]);
    // The store reports a failed recovery through its signal instead of throwing.
    store.recoverRoomChatMessages.mockImplementationOnce(() => {
      store.roomChatRecoveryFailed.set(true);
      return Promise.resolve();
    });
    await render();

    connectionStatus.set('reconnecting');
    await render();
    connectionStatus.set('connected');
    await render();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(message.text_content);

    store.recoverRoomChatMessages.mockImplementationOnce(() => {
      store.roomChatRecoveryFailed.set(false);
      return Promise.resolve();
    });
    component.retryHistory();
    await render();

    expect(store.recoverRoomChatMessages).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    // A recovery failure never reloads the history that already loaded.
    expect(store.getRoomChatMessages).toHaveBeenCalledTimes(1);
  });

  it('retries only the part that failed', async () => {
    store.getRoomChatMessages.mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    component.retryHistory();
    await fixture.whenStable();

    // Only the history failed, so nothing is merged in from the recovery path.
    expect(store.getRoomChatMessages).toHaveBeenCalledTimes(2);
    expect(store.recoverRoomChatMessages).not.toHaveBeenCalled();
  });

  it('sends on Enter but not while an input method editor is composing', async () => {
    await render();
    component.inputText.set('こんにちは');

    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      cancelable: true,
    });
    component.onComposerKeydown(composing);

    expect(store.sendRoomChatMessage).not.toHaveBeenCalled();
    expect(composing.defaultPrevented).toBe(false);

    const confirmed = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    });
    component.onComposerKeydown(confirmed);
    await fixture.whenStable();

    expect(store.sendRoomChatMessage).toHaveBeenCalledWith(
      'こんにちは',
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
    expect(confirmed.defaultPrevented).toBe(true);
  });
});

/** Stubs the scroll metrics of every element, including ones created later. */
function stubScrollMetricsForNewElements(metrics: {
  scrollHeight: number;
  clientHeight: number;
}): () => void {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => metrics.scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => metrics.clientHeight,
  });
  return () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
  };
}

/** jsdom does not lay out elements, so the scroll metrics are stubbed. */
function stubScrollMetrics(
  element: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number },
): void {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: metrics.clientHeight,
  });
}
