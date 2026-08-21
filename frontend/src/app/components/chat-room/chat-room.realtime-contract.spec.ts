import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ChatRoomComponent } from './chat-room.component';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Hello',
    is_read: false,
    created_at: '2026-08-21T18:00:00.000Z',
    sender: { id: 'user-2', display_name: 'Partner', avatar_url: null },
    ...overrides,
  };
}

describe('ChatRoomComponent realtime contract', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let realtimeHandler: ((data: unknown) => void) | undefined;
  let centrifuge: {
    isConnected: ReturnType<typeof signal<boolean>>;
    connect: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let typing: {
    typingUsers: ReturnType<typeof signal<never[]>>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    sendTyping: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const chatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockImplementation(async (payload: Partial<ChatMessage>) =>
        message({
          id: 'sent-message',
          sender_id: 'user-1',
          text_content: payload.text_content,
        }),
      ),
      addFavourite: vi.fn().mockResolvedValue(undefined),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
      translateText: vi.fn(),
    };

    centrifuge = {
      isConnected: signal(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockImplementation((channel: string, handler: (data: unknown) => void) => {
        if (channel === 'chat:room-1') realtimeHandler = handler;
        return { unsubscribe: vi.fn() };
      }),
      unsubscribe: vi.fn(),
    };

    typing = {
      typingUsers: signal([]),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTyping: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: CentrifugeService, useValue: centrifuge },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 'user-1', display_name: 'Me' }),
            getAccessToken: vi.fn().mockReturnValue('token'),
            unlockApp: vi.fn().mockResolvedValue(undefined),
            appLocked: signal(false),
          },
        },
        {
          provide: SafetyService,
          useValue: {
            getBlockedIdsAsync: vi.fn().mockResolvedValue([]),
            getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
            blockedUserIdsSignal: signal(new Set<string>()),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUserProfile: vi.fn().mockResolvedValue(null),
            getMyProfile: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: TypingService, useValue: typing },
        {
          provide: VocabularyStore,
          useValue: {
            translateWordOrSentence: vi.fn(),
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
          },
        },
        { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
        { provide: TextToSpeechService, useValue: { speak: vi.fn() } },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'room-1');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('connects the room to the realtime message stream and typing channel', () => {
    expect(centrifuge.connect).toHaveBeenCalled();
    expect(centrifuge.subscribe).toHaveBeenCalledWith('chat:room-1', expect.any(Function));
    expect(typing.connect).toHaveBeenCalledWith('room-1');
  });

  it('appends messages published on the room realtime channel', () => {
    const incoming = message({ id: 'incoming-message' });

    expect(realtimeHandler).toBeDefined();
    realtimeHandler?.({ message: incoming });

    expect(component.messages()).toEqual([incoming]);
  });

  it('shows transient realtime typing state and clears it after the timeout', () => {
    vi.useFakeTimers();
    try {
      realtimeHandler?.({ typing: true });
      expect(component.isTyping()).toBe(true);

      vi.advanceTimersByTime(3000);
      expect(component.isTyping()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('publishes typing state from the composer and clears it when the composer is empty', () => {
    const input = document.createElement('input');
    input.value = 'Typing';
    input.setSelectionRange(input.value.length, input.value.length);

    component.onComposerInput({ target: input } as unknown as Event);
    expect(typing.sendTyping).toHaveBeenLastCalledWith(true);

    input.value = '';
    input.setSelectionRange(0, 0);
    component.onComposerInput({ target: input } as unknown as Event);
    expect(typing.sendTyping).toHaveBeenLastCalledWith(false);
  });

  it('renders sent, delivered, and read receipts for the signed-in user messages', () => {
    component.messages.set([
      message({ id: 'sent', sender_id: 'user-1', delivery_status: 'sent' }),
      message({ id: 'delivered', sender_id: 'user-1', delivery_status: 'delivered' }),
      message({ id: 'read', sender_id: 'user-1', delivery_status: 'read', is_read: true }),
    ]);
    fixture.detectChanges();

    const sent = fixture.nativeElement.querySelector('#msg-sent') as HTMLElement;
    const delivered = fixture.nativeElement.querySelector('#msg-delivered') as HTMLElement;
    const read = fixture.nativeElement.querySelector('#msg-read') as HTMLElement;

    expect(sent.querySelectorAll('svg')).toHaveLength(1);
    expect(delivered.querySelectorAll('svg')).toHaveLength(2);
    expect(read.querySelectorAll('svg')).toHaveLength(2);
    expect(read.querySelectorAll('svg.text-secondary')).toHaveLength(2);
  });

  it('disconnects realtime and typing ownership when the room component is destroyed', () => {
    fixture.destroy();

    expect(centrifuge.unsubscribe).toHaveBeenCalledWith('chat:room-1');
    expect(typing.disconnect).toHaveBeenCalledOnce();
  });
});
