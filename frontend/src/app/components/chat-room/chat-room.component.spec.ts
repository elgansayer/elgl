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
    lockChat: ReturnType<typeof vi.fn>;
    unlockChat: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof signal>;
    getAccessToken: ReturnType<typeof vi.fn>;
    unlockApp: ReturnType<typeof vi.fn>;
    appLocked: ReturnType<typeof signal>;
  };

  beforeEach(async () => {
    mockChatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(makeMessage({ id: 'm2' })),
      addFavourite: vi.fn().mockResolvedValue(undefined),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
    };

    const mockCentrifugeService = {
      isConnected: signal(false),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue({}),
      unsubscribe: vi.fn(),
    };

    mockAuthService = {
      currentUser: signal({ id: 'user-1', display_name: 'Me' }),
      getAccessToken: vi.fn(),
      unlockApp: vi.fn().mockResolvedValue(undefined),
      appLocked: signal(false),
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

  describe('@mentions', () => {
    beforeEach(async () => {
      // Let the component's own async initialisation (loadParticipants, etc.) settle first,
      // otherwise it can overwrite the participants we set below for the test.
      await fixture.whenStable();
      component.participants.set([
        { user_id: 'user-2', user: { id: 'user-2', display_name: 'Alice', avatar_url: null } },
        { user_id: 'user-3', user: { id: 'user-3', display_name: 'Alistair', avatar_url: null } },
        { user_id: 'user-1', user: { id: 'user-1', display_name: 'Me', avatar_url: null } },
      ]);
    });

    function inputEvent(value: string, cursor: number): Event {
      const target = document.createElement('input');
      target.value = value;
      target.setSelectionRange(cursor, cursor);
      return { target } as unknown as Event;
    }

    it('shows matching participants once an "@" trigger is typed, excluding the current user', () => {
      component.onComposerInput(inputEvent('Hi @Al', 6));

      const suggestions = component.mentionSuggestions();
      expect(suggestions.map((s) => s.user?.display_name)).toEqual(['Alice', 'Alistair']);
    });

    it('clears suggestions once the trigger is no longer active', () => {
      component.onComposerInput(inputEvent('Hi @Al', 6));
      expect(component.mentionSuggestions().length).toBeGreaterThan(0);

      component.onComposerInput(inputEvent('Hi @Al ', 7));
      expect(component.mentionSuggestions()).toEqual([]);
    });

    it('selectMention replaces the in-progress query with the chosen display name', () => {
      component.textInput = 'Hi @Al';
      component.onComposerInput(inputEvent('Hi @Al', 6));

      component.selectMention(component.mentionSuggestions()[0]);

      expect(component.textInput).toBe('Hi @Alice ');
      expect(component.mentionSuggestions()).toEqual([]);
    });

    it('ArrowDown/ArrowUp move the active suggestion without sending the message', () => {
      component.onComposerInput(inputEvent('Hi @Al', 6));

      component.onComposerKeydown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent);
      expect(component.mentionActiveIndex()).toBe(1);

      component.onComposerKeydown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent);
      expect(component.mentionActiveIndex()).toBe(0);

      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('Enter selects the active suggestion instead of sending when the list is open', () => {
      component.textInput = 'Hi @Al';
      component.onComposerInput(inputEvent('Hi @Al', 6));

      component.onComposerKeydown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent);

      expect(component.textInput).toBe('Hi @Alice ');
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('Enter sends the message when no mention list is open', () => {
      component.textInput = 'Just a message';

      component.onComposerKeydown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text_content: 'Just a message' }),
      );
    });
  });

  describe('chat lock', () => {
    it('opening a locked room hides the conversation behind pendingUnlock', async () => {
      mockChatService.getRooms.mockResolvedValue([
        {
          id: 'room-1',
          title: 'Locked room',
          subtitle: '',
          avatar: '',
          is_online: false,
          is_pinned: false,
          is_locked: true,
          created_at: new Date().toISOString(),
        },
      ]);

      mockChatService.getMessages.mockClear();

      const lockedFixture = TestBed.createComponent(ChatRoomComponent);
      const lockedComponent = lockedFixture.componentInstance;
      lockedFixture.componentRef.setInput('id', 'room-1');
      lockedFixture.detectChanges();
      await lockedFixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      lockedFixture.detectChanges();

      expect(lockedComponent.isLocked()).toBe(true);
      expect(lockedComponent.pendingUnlock()).toBe(true);
      expect(mockChatService.getMessages).not.toHaveBeenCalled();
    });

    it('unlockRoom reveals the conversation once app unlock succeeds', async () => {
      component.roomId = 'room-1';
      component.isLocked.set(true);
      component.pendingUnlock.set(true);
      mockAuthService.unlockApp.mockImplementation(async () => {
        mockAuthService.appLocked.set(false);
      });

      await component.unlockRoom();

      expect(mockAuthService.unlockApp).toHaveBeenCalled();
      expect(component.pendingUnlock()).toBe(false);
      expect(mockChatService.getMessages).toHaveBeenCalledWith('room-1', '');
    });

    it('unlockRoom keeps the conversation hidden if app unlock fails', async () => {
      component.roomId = 'room-1';
      component.isLocked.set(true);
      component.pendingUnlock.set(true);
      mockChatService.getMessages.mockClear();
      mockAuthService.unlockApp.mockImplementation(async () => {
        mockAuthService.appLocked.set(true);
      });

      await component.unlockRoom();

      expect(component.pendingUnlock()).toBe(true);
      expect(mockChatService.getMessages).not.toHaveBeenCalled();
    });

    it('toggleLock locks and unlocks the current room', async () => {
      component.roomId = 'room-1';
      component.isLocked.set(false);

      await component.toggleLock();
      expect(mockChatService.lockChat).toHaveBeenCalledWith('room-1');
      expect(component.isLocked()).toBe(true);

      await component.toggleLock();
      expect(mockChatService.unlockChat).toHaveBeenCalledWith('room-1');
      expect(component.isLocked()).toBe(false);
    });
  });
});
