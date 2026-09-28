import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatRoomComponent } from './chat-room.component';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { TypingService } from '../../services/typing.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { NetworkStatusService } from '../../services/network-status.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
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
    translateText: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof signal>;
    getAccessToken: ReturnType<typeof vi.fn>;
    unlockApp: ReturnType<typeof vi.fn>;
    appLocked: ReturnType<typeof signal>;
  };
  let mockTextToSpeechService: { speak: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockChatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(makeMessage({ id: 'm2' })),
      addFavourite: vi.fn().mockResolvedValue(undefined),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
      translateText: vi.fn(),
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
      checkGrammar: vi.fn().mockResolvedValue({
        original: '',
        corrected: '',
        explanation: '',
        errors_found: 0,
      }),
    };

    const mockTypingService = {
      typingUsers: signal([]),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTyping: vi.fn(),
    };

    const mockNetworkStatusService = {
      isOnline: signal(true),
    };

    mockTextToSpeechService = {
      speak: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: CentrifugeService, useValue: mockCentrifugeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SafetyService, useValue: mockSafetyService },
        { provide: UserService, useValue: mockUserService },
        { provide: TypingService, useValue: mockTypingService },
        { provide: VocabularyStore, useValue: mockVocabularyStore },
        { provide: NetworkStatusService, useValue: mockNetworkStatusService },
        { provide: TextToSpeechService, useValue: mockTextToSpeechService },
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

    it('itemToString replaces the in-progress query with the chosen display name', () => {
      component.textInput = 'Hi @Al';
      component.onComposerInput(inputEvent('Hi @Al', 6));

      const selectedText = component.mentionItemToString(component.mentionSuggestions()[0]);

      expect(selectedText).toBe('Hi @Alice ');
    });

    it('selection clears the product mention query after Spartan chooses an option', () => {
      component.onComposerInput(inputEvent('Hi @Al', 6));
      expect(component.mentionSuggestions().length).toBeGreaterThan(0);

      component.onMentionSelected(component.mentionSuggestions()[0]);

      expect(component.mentionSuggestions()).toEqual([]);
    });

    it('ArrowDown/ArrowUp are left to the owned Spartan autocomplete', () => {
      component.onComposerInput(inputEvent('Hi @Al', 6));
      const downPreventDefault = vi.fn();
      const upPreventDefault = vi.fn();

      component.onComposerKeydown({
        key: 'ArrowDown',
        preventDefault: downPreventDefault,
      } as unknown as KeyboardEvent);
      component.onComposerKeydown({
        key: 'ArrowUp',
        preventDefault: upPreventDefault,
      } as unknown as KeyboardEvent);

      expect(downPreventDefault).not.toHaveBeenCalled();
      expect(upPreventDefault).not.toHaveBeenCalled();
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('Enter is left to Spartan when mention options are open', () => {
      component.textInput = 'Hi @Al';
      component.onComposerInput(inputEvent('Hi @Al', 6));
      const preventDefault = vi.fn();

      component.onComposerKeydown({ key: 'Enter', preventDefault } as unknown as KeyboardEvent);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('Enter sends the message when no mention list is open', async () => {
      component.textInput = 'Just a message';

      component.onComposerKeydown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
      // onComposerKeydown fire-and-forgets the async sendTextMessage(), which
      // awaits a grammar check before sending - flush that microtask chain.
      await Promise.resolve();
      await Promise.resolve();

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text_content: 'Just a message' }),
      );
    });
  });

  describe('in-line message context menu actions', () => {
    it('transliterateMessage stores the transliteration returned by the NLP service', async () => {
      const msg = makeMessage({ id: 'm1', text_content: 'Bonjour' });
      const mockVocabularyStore = TestBed.inject(VocabularyStore) as unknown as {
        translateWordOrSentence: ReturnType<typeof vi.fn>;
      };
      mockVocabularyStore.translateWordOrSentence.mockResolvedValue({
        original_text: 'Bonjour',
        translated_text: 'Hello',
        detected_language: 'fr',
        transliteration: 'bon-zhoor',
      });

      await component.transliterateMessage(msg);

      expect(mockVocabularyStore.translateWordOrSentence).toHaveBeenCalledWith('Bonjour', 'en');
      expect(component.transliterations()['m1']).toBe('bon-zhoor');
    });

    it('transliterateMessage falls back to the translated text when no transliteration is returned', async () => {
      const msg = makeMessage({ id: 'm1', text_content: 'Bonjour' });
      const mockVocabularyStore = TestBed.inject(VocabularyStore) as unknown as {
        translateWordOrSentence: ReturnType<typeof vi.fn>;
      };
      mockVocabularyStore.translateWordOrSentence.mockResolvedValue({
        original_text: 'Bonjour',
        translated_text: 'Hello',
        detected_language: 'fr',
      });

      await component.transliterateMessage(msg);

      expect(component.transliterations()['m1']).toBe('Hello');
    });

    it('toggleTranslation fetches and shows the translation for a message', async () => {
      const msg = makeMessage({ id: 'm1', text_content: 'Bonjour' });
      mockChatService.translateText.mockResolvedValue({ translated_text: 'Hello' });

      await component.toggleTranslation(msg);

      expect(mockChatService.translateText).toHaveBeenCalledWith('Bonjour', expect.any(String));
      expect(component.translations()['m1']).toBe('Hello');
      expect(component.showTranslation()['m1']).toBe(true);
    });

    it('toggleTranslation hides an already-visible translation without re-fetching', async () => {
      const msg = makeMessage({ id: 'm1', text_content: 'Bonjour' });
      mockChatService.translateText.mockResolvedValue({ translated_text: 'Hello' });

      await component.toggleTranslation(msg);
      mockChatService.translateText.mockClear();
      await component.toggleTranslation(msg);

      expect(mockChatService.translateText).not.toHaveBeenCalled();
      expect(component.showTranslation()['m1']).toBe(false);
    });

    it('speakMessage speaks the message text when speech synthesis is supported', () => {
      component.speakMessage(makeMessage({ text_content: 'Hello there' }));

      expect(mockTextToSpeechService.speak).toHaveBeenCalledWith('m1', 'Hello there');
    });

    it('speakMessage does nothing for a message with no text content', () => {
      const speak = vi.fn();
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { speak, cancel: vi.fn() },
      });

      component.speakMessage(makeMessage({ text_content: '' }));

      expect(speak).not.toHaveBeenCalled();
    });

    it('startCorrection pre-fills the correction form from the selected message', () => {
      const msg = makeMessage({ id: 'm1', text_content: 'I goed to school' });

      component.startCorrection(msg);

      expect(component.showCorrectionForm()).toBe(true);
      expect(component.originalText).toBe('I goed to school');
    });

    it('requestCorrection sends a correction_request message', async () => {
      const msg = makeMessage({ id: 'm1', text_content: 'I goed to school' });
      const sent = makeMessage({ id: 'm2', message_type: 'correction_request' });
      mockChatService.sendMessage.mockResolvedValueOnce(sent);

      await component.requestCorrection(msg);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith({
        room_id: 'room-1',
        message_type: 'correction_request',
        correction_request_payload: { original_text: 'I goed to school' },
        reply_to_id: 'm1',
      });
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
