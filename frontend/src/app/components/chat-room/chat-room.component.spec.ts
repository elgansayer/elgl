import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatRoomComponent } from './chat-room.component';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Hello there',
    is_read: true,
    created_at: new Date().toISOString(),
    sender: { id: 'user-2', display_name: 'Emma', avatar_url: null },
    ...overrides,
  };
}

describe('ChatRoomComponent (threaded replies)', () => {
  let component: ChatRoomComponent;
  let fixture: ComponentFixture<ChatRoomComponent>;
  let mockChatService: {
    getRooms: ReturnType<typeof vi.fn>;
    getGroupMembers: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    addFavourite: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockChatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(makeMessage({ id: 'm2' })),
      addFavourite: vi.fn().mockResolvedValue(undefined),
    };

    const mockCentrifugeService = {
      isConnected: signal(false),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue({}),
      unsubscribe: vi.fn(),
    };

    const mockAuthService = {
      currentUser: signal({ id: 'user-1', display_name: 'Me' }),
      getAccessToken: vi.fn(),
    };

    const mockSafetyService = {
      getBlockedIdsAsync: vi.fn().mockResolvedValue([]),
      getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
      blockedUserIdsSignal: signal(new Set<string>()),
    };

    const mockUserService = {
      getUserProfile: vi.fn().mockResolvedValue(null),
      getMyProfile: vi.fn().mockResolvedValue(null),
    };

    const mockVocabularyStore = {
      translateWordOrSentence: vi.fn(),
      saveWord: vi.fn(),
      updateSrsLevel: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: CentrifugeService, useValue: mockCentrifugeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SafetyService, useValue: mockSafetyService },
        { provide: UserService, useValue: mockUserService },
        { provide: VocabularyStore, useValue: mockVocabularyStore },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'room-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('startReply sets replyingTo to the matching message', () => {
    const parent = makeMessage({ id: 'm1' });
    component.messages.set([parent]);

    component.startReply('m1');

    expect(component.replyingTo()).toEqual(parent);
  });

  it('cancelReply clears replyingTo', () => {
    component.messages.set([makeMessage({ id: 'm1' })]);
    component.startReply('m1');

    component.cancelReply();

    expect(component.replyingTo()).toBeNull();
  });

  it('parentMessageFor returns undefined when the message has no reply_to_id', () => {
    const msg = makeMessage({ id: 'm2', reply_to_id: undefined });
    expect(component.parentMessageFor(msg)).toBeUndefined();
  });

  it('parentMessageFor resolves the parent message from the loaded list', () => {
    const parent = makeMessage({ id: 'm1', text_content: 'Original message' });
    const reply = makeMessage({ id: 'm2', reply_to_id: 'm1' });
    component.messages.set([parent, reply]);

    expect(component.parentMessageFor(reply)).toEqual(parent);
  });

  it('sendTextMessage includes reply_to_id and clears the reply preview afterwards', async () => {
    const parent = makeMessage({ id: 'm1' });
    component.messages.set([parent]);
    component.replyingTo.set(parent);
    component.textInput = 'A reply';

    await component.sendTextMessage();

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'A reply', reply_to_id: 'm1' }),
    );
    expect(component.replyingTo()).toBeNull();
  });

  it('scrollToMessage scrolls to and briefly highlights the target message', () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.id = 'msg-m1';
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    component.scrollToMessage('m1');

    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(component.highlightedMessageId()).toBe('m1');

    vi.advanceTimersByTime(1500);
    expect(component.highlightedMessageId()).toBeNull();

    document.body.removeChild(el);
    vi.useRealTimers();
  });
});
