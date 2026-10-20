import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { DraftService } from '../../services/draft.service';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ChatRoomComponent } from './chat-room.component';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'sent-1',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'text',
    text_content: 'Recover me',
    is_read: true,
    created_at: new Date().toISOString(),
    sender: { id: 'user-1', display_name: 'Me', avatar_url: null },
    ...overrides,
  };
}

describe('ChatRoomComponent failed-send draft recovery', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;
  let draftService: {
    saveChatDraft: ReturnType<typeof vi.fn>;
    loadChatDraft: ReturnType<typeof vi.fn>;
    clearChatDraft: ReturnType<typeof vi.fn>;
    saveChatDraftV2: ReturnType<typeof vi.fn>;
    loadChatDraftV2: ReturnType<typeof vi.fn>;
    clearChatDraftV2: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    sendMessage = vi.fn().mockResolvedValue(makeMessage());
    draftService = {
      saveChatDraft: vi.fn(),
      loadChatDraft: vi.fn().mockReturnValue(''),
      clearChatDraft: vi.fn(),
      saveChatDraftV2: vi.fn(),
      loadChatDraftV2: vi.fn().mockReturnValue(null),
      clearChatDraftV2: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getRooms: vi.fn().mockResolvedValue([]),
            getGroupMembers: vi.fn().mockResolvedValue([]),
            getMessages: vi.fn().mockResolvedValue([]),
            sendMessage,
            addFavourite: vi.fn().mockResolvedValue(undefined),
            lockChat: vi.fn().mockResolvedValue(undefined),
            unlockChat: vi.fn().mockResolvedValue(undefined),
            translateText: vi.fn(),
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            isConnected: signal(false),
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
            unsubscribe: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 'user-1', display_name: 'Me' }),
            getAccessToken: vi.fn(),
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
        {
          provide: TypingService,
          useValue: {
            typingUsers: signal([]),
            connect: vi.fn(),
            disconnect: vi.fn(),
            sendTyping: vi.fn(),
          },
        },
        {
          provide: VocabularyStore,
          useValue: {
            translateWordOrSentence: vi.fn(),
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
            checkGrammar: vi.fn().mockResolvedValue({
              original: 'Recover me',
              corrected: 'Recover me',
              explanation: '',
              errors_found: 0,
            }),
          },
        },
        { provide: DraftService, useValue: draftService },
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

    draftService.saveChatDraft.mockClear();
    draftService.saveChatDraftV2.mockClear();
    draftService.clearChatDraft.mockClear();
    draftService.clearChatDraftV2.mockClear();
  });

  it('does not clear the persisted draft while the send is still in flight', async () => {
    let resolveSend!: (message: ChatMessage) => void;
    sendMessage.mockImplementationOnce(
      () => new Promise<ChatMessage>((resolve) => (resolveSend = resolve)),
    );
    component.textInput = 'Recover me';

    const sending = component.sendTextMessage();
    await Promise.resolve();
    await Promise.resolve();

    expect(draftService.clearChatDraft).not.toHaveBeenCalled();
    expect(draftService.clearChatDraftV2).not.toHaveBeenCalled();
    expect(component.textInput).toBe('Recover me');

    resolveSend(makeMessage());
    await sending;
  });

  it('keeps failed text in the composer and persists it for recovery', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMessage.mockRejectedValueOnce(new Error('offline'));
    component.textInput = '  Recover me  ';

    await component.sendTextMessage();

    expect(component.textInput).toBe('  Recover me  ');
    expect(draftService.clearChatDraft).not.toHaveBeenCalled();
    expect(draftService.clearChatDraftV2).not.toHaveBeenCalled();
    expect(draftService.saveChatDraft).toHaveBeenCalledWith('room-1', 'Recover me');
    errorSpy.mockRestore();
  });

  it('clears composer and persisted draft only after a successful send', async () => {
    component.textInput = 'Recover me';

    await component.sendTextMessage();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: 'room-1', text_content: 'Recover me' }),
    );
    expect(component.textInput).toBe('');
    expect(draftService.clearChatDraft).toHaveBeenCalledWith('room-1');
    expect(draftService.clearChatDraftV2).toHaveBeenCalledWith('room-1');
  });
});
