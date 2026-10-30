import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { DraftService } from '../../services/draft.service';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ChatRoomComponent } from './chat-room.component';

const chatDraftKey = (userId: string, roomId: string): string =>
  `ht_${userId}_draft_chat_v2_${roomId}`;

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Original message',
    is_read: true,
    created_at: new Date().toISOString(),
    sender: { id: 'user-2', display_name: 'Partner', avatar_url: null },
    ...overrides,
  };
}

/** Lets the fire-and-forget initialisation chain started by the room effect settle. */
async function settle(fixture: ComponentFixture<ChatRoomComponent>): Promise<void> {
  for (let pass = 0; pass < 4; pass += 1) {
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
}

/** Mirrors what the composer does on every keystroke: bind the value, then raise the input hook. */
function type(component: ChatRoomComponent, value: string): void {
  const input = document.createElement('input');
  input.value = value;
  component.textInput = value;
  component.onComposerInput({ target: input } as unknown as Event);
}

describe('ChatRoomComponent draft restore and persistence', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let draftService: DraftService;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;
  let getMessages: ReturnType<typeof vi.fn>;
  let getRooms: ReturnType<typeof vi.fn>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let roomMessages: Record<string, ChatMessage[]>;

  async function createRoom(roomId = 'room-1'): Promise<void> {
    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', roomId);
    fixture.detectChanges();
    await settle(fixture);
  }

  async function openRoom(roomId: string): Promise<void> {
    fixture.componentRef.setInput('id', roomId);
    fixture.detectChanges();
    await settle(fixture);
  }

  beforeEach(async () => {
    localStorage.clear();
    roomMessages = { 'room-1': [makeMessage()], 'room-2': [] };
    getMessages = vi.fn((roomId: string) => Promise.resolve(roomMessages[roomId] ?? []));
    getRooms = vi.fn().mockResolvedValue([]);
    sendMessage = vi.fn((payload: { room_id: string; text_content?: string }) =>
      Promise.resolve(
        makeMessage({
          id: `sent-${payload.room_id}`,
          room_id: payload.room_id,
          sender_id: 'user-1',
          text_content: payload.text_content,
        }),
      ),
    );
    currentUser = signal<{ id: string } | null>({ id: 'user-1' });

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getRooms,
            getGroupMembers: vi.fn().mockResolvedValue([]),
            getMessages,
            sendMessage,
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
            unsubscribe: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            appLocked: signal(false),
            unlockApp: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UserService,
          useValue: {
            getMyProfile: vi.fn().mockResolvedValue(null),
            getUserProfile: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedIdsAsync: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: TypingService,
          useValue: { connect: vi.fn(), disconnect: vi.fn(), sendTyping: vi.fn() },
        },
        {
          provide: VocabularyStore,
          useValue: {
            checkGrammar: vi.fn().mockResolvedValue({
              original: '',
              corrected: '',
              explanation: '',
              errors_found: 0,
            }),
            translateWordOrSentence: vi.fn(),
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
          },
        },
        { provide: TextToSpeechService, useValue: { speak: vi.fn() } },
        { provide: TranslationCacheService, useValue: { get: vi.fn(), set: vi.fn() } },
        {
          provide: I18nService,
          useValue: { currentLang: signal('en-GB'), translate: vi.fn((key: string) => key) },
        },
      ],
    })
      .overrideComponent(ChatRoomComponent, { set: { template: '' } })
      .compileComponents();

    draftService = TestBed.inject(DraftService);
  });

  afterEach(() => {
    fixture?.destroy();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('restoring on open', () => {
    it('restores the composer text and the reply target saved by a previous visit', async () => {
      draftService.saveChatDraftV2('room-1', { textInput: 'Half written', replyToId: 'm1' });

      await createRoom('room-1');

      expect(component.textInput).toBe('Half written');
      expect(component.replyingTo()?.id).toBe('m1');
    });

    it('restores before the history request settles so early typing cannot race the draft', async () => {
      draftService.saveChatDraftV2('room-1', { textInput: 'Half written' });
      let releaseHistory!: (messages: ChatMessage[]) => void;
      getMessages.mockImplementationOnce(
        () => new Promise<ChatMessage[]>((resolve) => (releaseHistory = resolve)),
      );

      fixture = TestBed.createComponent(ChatRoomComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('id', 'room-1');
      fixture.detectChanges();
      await settle(fixture);

      expect(component.textInput).toBe('Half written');
      releaseHistory([]);
      await settle(fixture);
    });

    it('keeps text typed while the room was still loading instead of overwriting it', async () => {
      draftService.saveChatDraftV2('room-1', { textInput: 'Old draft' });
      let releaseRooms!: (rooms: unknown[]) => void;
      getRooms.mockImplementationOnce(
        () => new Promise<unknown[]>((resolve) => (releaseRooms = resolve)),
      );

      fixture = TestBed.createComponent(ChatRoomComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('id', 'room-1');
      fixture.detectChanges();
      component.textInput = 'Typed first';

      releaseRooms([]);
      await settle(fixture);

      expect(component.textInput).toBe('Typed first');
    });

    it('does not read or write the shared anonymous namespace before the account is known', async () => {
      currentUser.set(null);
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      await createRoom('room-1');
      type(component, 'Typed while signed out');

      expect(getItem.mock.calls.some(([key]) => String(key).startsWith('ht_anon'))).toBe(false);
      expect(setItem.mock.calls.some(([key]) => String(key).startsWith('ht_anon'))).toBe(false);
    });
  });

  describe('leaving before the draft was restored', () => {
    it('never deletes the stored draft when the room is destroyed while still loading', async () => {
      draftService.saveChatDraftV2('room-1', { textInput: 'Precious draft', replyToId: 'm1' });
      getRooms.mockReturnValue(new Promise(() => undefined));

      await createRoom('room-1');
      fixture.destroy();

      expect(localStorage.getItem(chatDraftKey('user-1', 'room-1'))).not.toBeNull();
      expect(draftService.loadChatDraftV2('room-1')?.textInput).toBe('Precious draft');
    });

    it('never deletes the stored draft of a locked room that was not unlocked', async () => {
      draftService.saveChatDraftV2('room-1', { textInput: 'Private draft' });
      getRooms.mockResolvedValue([{ id: 'room-1', is_locked: true }]);

      await createRoom('room-1');
      expect(component.pendingUnlock()).toBe(true);
      expect(component.textInput).toBe('');
      fixture.destroy();

      expect(draftService.loadChatDraftV2('room-1')?.textInput).toBe('Private draft');
    });
  });

  describe('switching rooms inside one component instance', () => {
    it('saves the outgoing room and shows a clean composer for a room without a draft', async () => {
      await createRoom('room-1');
      type(component, 'Meant for room one');

      await openRoom('room-2');

      expect(draftService.loadChatDraftV2('room-1')?.textInput).toBe('Meant for room one');
      expect(component.textInput).toBe('');
      expect(component.replyingTo()).toBeNull();
    });

    it('restores each room draft when moving between rooms and back', async () => {
      draftService.saveChatDraftV2('room-2', { textInput: 'Waiting in room two' });
      await createRoom('room-1');
      type(component, 'Meant for room one');

      await openRoom('room-2');
      expect(component.textInput).toBe('Waiting in room two');

      await openRoom('room-1');
      expect(component.textInput).toBe('Meant for room one');
    });

    it('does not carry a reply target or correction state into the next room', async () => {
      await createRoom('room-1');
      component.startReply('m1');
      component.startCorrection(makeMessage());

      await openRoom('room-2');

      expect(component.replyingTo()).toBeNull();
      expect(component.showCorrectionForm()).toBe(false);
      expect(component.originalText).toBe('');
    });

    it('does not reinitialise the room when only the reply target changes afterwards', async () => {
      await createRoom('room-1');
      await openRoom('room-2');
      await openRoom('room-1');
      const loadsAfterSwitching = getMessages.mock.calls.length;

      component.startReply('m1');
      fixture.detectChanges();
      await settle(fixture);
      component.cancelReply();
      fixture.detectChanges();
      await settle(fixture);

      expect(getMessages).toHaveBeenCalledTimes(loadsAfterSwitching);
    });

    it('does not leak a send that completes after the room changed into the new room', async () => {
      await createRoom('room-1');
      let releaseSend!: (message: ChatMessage) => void;
      sendMessage.mockImplementationOnce(
        () => new Promise<ChatMessage>((resolve) => (releaseSend = resolve)),
      );
      type(component, 'Slow message');
      const sending = component.sendTextMessage();
      await settle(fixture);

      await openRoom('room-2');
      type(component, 'Typing in room two');
      releaseSend(makeMessage({ id: 'sent-room-1', room_id: 'room-1', sender_id: 'user-1' }));
      await sending;

      expect(component.textInput).toBe('Typing in room two');
      expect(component.messages().some((m) => m.id === 'sent-room-1')).toBe(false);
      expect(draftService.loadChatDraftV2('room-2')?.textInput).toBe('Typing in room two');
      expect(draftService.loadChatDraftV2('room-1')).toBeNull();
    });
  });

  describe('persisting composer changes', () => {
    it('persists choosing and cancelling a reply without waiting for another keystroke', async () => {
      await createRoom('room-1');
      type(component, 'Replying');

      component.startReply('m1');
      expect(draftService.loadChatDraftV2('room-1')?.replyToId).toBe('m1');

      component.cancelReply();
      expect(draftService.loadChatDraftV2('room-1')?.replyToId ?? null).toBeNull();
      expect(draftService.loadChatDraftV2('room-1')?.textInput).toBe('Replying');
    });

    it('removes the stored draft once the composer is emptied', async () => {
      await createRoom('room-1');
      type(component, 'Short lived');
      type(component, '');

      expect(localStorage.getItem(chatDraftKey('user-1', 'room-1'))).toBeNull();
    });
  });

  describe('sending', () => {
    it('ignores a second submit while the first send is still in flight', async () => {
      await createRoom('room-1');
      let releaseSend!: (message: ChatMessage) => void;
      sendMessage.mockImplementationOnce(
        () => new Promise<ChatMessage>((resolve) => (releaseSend = resolve)),
      );
      type(component, 'Send me once');

      const first = component.sendTextMessage();
      await settle(fixture);
      const second = component.sendTextMessage();
      releaseSend(makeMessage({ id: 'sent-1', sender_id: 'user-1' }));
      await Promise.all([first, second]);

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(component.textInput).toBe('');
      expect(localStorage.getItem(chatDraftKey('user-1', 'room-1'))).toBeNull();
    });

    it('keeps a newer composition written while an earlier send is in flight', async () => {
      await createRoom('room-1');
      let releaseSend!: (message: ChatMessage) => void;
      sendMessage.mockImplementationOnce(
        () => new Promise<ChatMessage>((resolve) => (releaseSend = resolve)),
      );
      type(component, 'First message');

      const sending = component.sendTextMessage();
      await settle(fixture);
      type(component, 'Second message');
      releaseSend(makeMessage({ id: 'sent-1', sender_id: 'user-1' }));
      await sending;

      expect(component.textInput).toBe('Second message');
      expect(draftService.loadChatDraftV2('room-1')?.textInput).toBe('Second message');
    });

    it('keeps the draft, including the reply target, when the send fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await createRoom('room-1');
      component.startReply('m1');
      type(component, 'Please retry me');
      sendMessage.mockRejectedValueOnce(new Error('offline'));

      await component.sendTextMessage();

      expect(component.textInput).toBe('Please retry me');
      expect(draftService.loadChatDraftV2('room-1')).toMatchObject({
        textInput: 'Please retry me',
        replyToId: 'm1',
      });

      await component.sendTextMessage();
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(draftService.loadChatDraftV2('room-1')).toBeNull();
    });
  });
});
