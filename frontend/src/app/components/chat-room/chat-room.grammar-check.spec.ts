import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatService } from '../../services/chat.service';
import { DraftService } from '../../services/draft.service';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ChatRoomComponent } from './chat-room.component';

describe('ChatRoomComponent pre-send grammar review', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;
  let checkGrammar: ReturnType<typeof vi.fn>;
  let saveChatDraft: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sendMessage = vi.fn().mockResolvedValue({
      id: 'message-1',
      room_id: 'room-1',
      sender_id: 'user-1',
      message_type: 'text',
      text_content: 'I went to school yesterday.',
      is_read: false,
      created_at: new Date().toISOString(),
    });
    checkGrammar = vi.fn();
    saveChatDraft = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getRooms: vi.fn().mockResolvedValue([]),
            getGroupMembers: vi.fn().mockResolvedValue([
              {
                user_id: 'user-2',
                user: {
                  id: 'user-2',
                  display_name: 'Partner',
                  avatar_url: null,
                },
              },
            ]),
            getMessages: vi.fn().mockResolvedValue([]),
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
            currentUser: signal({ id: 'user-1' }),
            appLocked: signal(false),
            unlockApp: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UserService,
          useValue: {
            getMyProfile: vi.fn().mockResolvedValue(null),
            getUserProfile: vi.fn().mockResolvedValue({ native_languages: ['en-GB'] }),
          },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedIdsAsync: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: TypingService,
          useValue: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            sendTyping: vi.fn(),
          },
        },
        {
          provide: VocabularyStore,
          useValue: {
            checkGrammar,
            translateWordOrSentence: vi.fn(),
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
          },
        },
        {
          provide: TextToSpeechService,
          useValue: { speak: vi.fn() },
        },
        {
          provide: DraftService,
          useValue: {
            saveChatDraft,
            saveChatDraftV2: vi.fn(),
            loadChatDraft: vi.fn().mockReturnValue(null),
            loadChatDraftV2: vi.fn().mockReturnValue(null),
            clearChatDraft: vi.fn(),
            clearChatDraftV2: vi.fn(),
          },
        },
        {
          provide: TranslationCacheService,
          useValue: { get: vi.fn(), set: vi.fn() },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    })
      .overrideComponent(ChatRoomComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'room-1');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('replaces the composer text with a suggestion and waits for user review', async () => {
    checkGrammar.mockResolvedValue({
      original: 'I go to school yesterday.',
      corrected: 'I went to school yesterday.',
      explanation: 'Use the past tense.',
      errors_found: 1,
    });
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledWith(
      'I go to school yesterday.',
      'en-GB',
    );
    expect(component.textInput).toBe('I went to school yesterday.');
    expect(saveChatDraft).toHaveBeenCalledWith(
      'room-1',
      'I went to school yesterday.',
    );
    expect(sendMessage).not.toHaveBeenCalled();
    expect(component.isCheckingGrammar()).toBe(false);
  });

  it('sends an accepted suggestion when the user submits it again', async () => {
    checkGrammar
      .mockResolvedValueOnce({
        original: 'I go to school yesterday.',
        corrected: 'I went to school yesterday.',
        explanation: 'Use the past tense.',
        errors_found: 1,
      })
      .mockResolvedValueOnce({
        original: 'I went to school yesterday.',
        corrected: 'I went to school yesterday.',
        explanation: 'No grammar changes suggested.',
        errors_found: 0,
      });
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();
    await component.sendTextMessage();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'I went to school yesterday.' }),
    );
    expect(component.textInput).toBe('');
  });

  it('prevents duplicate grammar checks while a submission is already being reviewed', async () => {
    let resolveGrammar: ((value: unknown) => void) | undefined;
    checkGrammar.mockReturnValue(
      new Promise((resolve) => {
        resolveGrammar = resolve;
      }),
    );
    component.textInput = 'I have went to the station yesterday.';

    const firstSubmission = component.sendTextMessage();
    const secondSubmission = component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(component.isCheckingGrammar()).toBe(true);

    resolveGrammar?.({
      original: component.textInput,
      corrected: component.textInput,
      explanation: 'No grammar changes suggested.',
      errors_found: 0,
    });
    await Promise.all([firstSubmission, secondSubmission]);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(component.isCheckingGrammar()).toBe(false);
  });

  it('keeps sending available when the advisory checker degrades without a suggestion', async () => {
    checkGrammar.mockResolvedValue({
      original: 'Keep my wording',
      corrected: 'Keep my wording',
      explanation: 'Grammar check is currently unavailable',
      errors_found: 0,
    });
    component.textInput = 'Keep my wording';

    await component.sendTextMessage();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'Keep my wording' }),
    );
  });
});
