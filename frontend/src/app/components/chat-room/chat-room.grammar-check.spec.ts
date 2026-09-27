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
import { toastsSignal } from '../../services/toast.service';
import { GRAMMAR_REVIEW_TOAST_MS } from '../../services/grammar-review';
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
  let translate: ReturnType<typeof vi.fn>;

  const flagged = {
    original: 'I go to school yesterday.',
    corrected: 'I went to school yesterday.',
    explanation: 'Use the past tense.',
    errors_found: 1,
  };

  beforeEach(async () => {
    toastsSignal.set([]);
    translate = vi.fn(
      (key: string, params?: Record<string, unknown>) =>
        `${key}:${String(params?.['explanation'] ?? '')}`,
    );
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
            translate,
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
    // initializeRoom() runs fire-and-forget from a constructor effect() and
    // chains many sequential awaits (loadRoomDetails -> ... ->
    // resolvePartnerLanguage) that aren't tracked by Angular's zoneless
    // stability signal, so whenStable() alone can resolve before the chain
    // finishes. Flush the microtask queue once more to let it settle.
    await Promise.resolve();
  });

  afterEach(() => {
    vi.useRealTimers();
    toastsSignal.set([]);
    fixture.destroy();
  });

  it('replaces the composer text with a suggestion and waits for user review', async () => {
    checkGrammar.mockResolvedValue(flagged);
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledWith('I go to school yesterday.', 'en-GB');
    expect(component.textInput).toBe('I went to school yesterday.');
    expect(saveChatDraft).toHaveBeenCalledWith('room-1', 'I went to school yesterday.');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(component.isCheckingGrammar()).toBe(false);
    expect(component.grammarReview()).toEqual({
      original: 'I go to school yesterday.',
      suggestion: 'I went to school yesterday.',
    });
  });

  it('explains the suggestion with a translated toast that stays readable', async () => {
    vi.useFakeTimers();
    checkGrammar.mockResolvedValue(flagged);
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();

    expect(translate).toHaveBeenCalledWith('grammarReview.suggestionApplied', {
      explanation: 'Use the past tense.',
    });
    expect(toastsSignal().map((toast) => toast.message)).toEqual([
      'grammarReview.suggestionApplied:Use the past tense.',
    ]);

    vi.advanceTimersByTime(GRAMMAR_REVIEW_TOAST_MS - 1);
    expect(toastsSignal()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toastsSignal()).toHaveLength(0);
  });

  it('sends an accepted suggestion when the user submits it again', async () => {
    checkGrammar.mockResolvedValueOnce(flagged);
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();
    await component.sendTextMessage();

    // Accepting a suggestion the learner has already reviewed must not spend a
    // second provider call or risk a second, different suggestion.
    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'I went to school yesterday.' }),
    );
    expect(component.textInput).toBe('');
    expect(component.grammarReview()).toBeNull();
  });

  it('never traps a message when the provider would suggest new wording every time', async () => {
    let attempt = 0;
    checkGrammar.mockImplementation((text: string) => {
      attempt += 1;
      return Promise.resolve({
        original: text,
        corrected: `${text} (variant ${attempt})`,
        explanation: 'Another suggestion.',
        errors_found: 1,
      });
    });
    component.textInput = 'Hello there';

    await component.sendTextMessage();
    expect(sendMessage).not.toHaveBeenCalled();
    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'Hello there (variant 1)' }),
    );
  });

  it('lets the learner keep their own wording by resubmitting it after the suggestion', async () => {
    checkGrammar.mockResolvedValueOnce(flagged);
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();
    component.textInput = 'I go to school yesterday.';
    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'I go to school yesterday.' }),
    );
  });

  it('checks again when the learner edits the suggestion into new wording', async () => {
    checkGrammar.mockResolvedValueOnce(flagged).mockResolvedValueOnce({
      original: 'I went to the school yesterday.',
      corrected: 'I went to the school yesterday.',
      explanation: 'No grammar changes suggested.',
      errors_found: 0,
    });
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();
    component.textInput = 'I went to the school yesterday.';
    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledTimes(2);
    expect(checkGrammar).toHaveBeenLastCalledWith('I went to the school yesterday.', 'en-GB');
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'I went to the school yesterday.' }),
    );
  });

  it('checks the same wording again once a reviewed message has been sent', async () => {
    checkGrammar.mockResolvedValue(flagged);
    component.textInput = 'I go to school yesterday.';
    await component.sendTextMessage();
    await component.sendTextMessage();
    expect(sendMessage).toHaveBeenCalledTimes(1);

    component.textInput = 'I go to school yesterday.';
    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps the review when sending the reviewed wording fails so a retry still sends it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    checkGrammar.mockResolvedValueOnce(flagged);
    sendMessage.mockRejectedValueOnce(new Error('offline'));
    component.textInput = 'I go to school yesterday.';

    await component.sendTextMessage();
    await component.sendTextMessage();
    expect(saveChatDraft).toHaveBeenLastCalledWith('room-1', 'I went to school yesterday.');

    await component.sendTextMessage();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('drops the review when the learner moves to another room', async () => {
    checkGrammar.mockResolvedValueOnce(flagged);
    component.textInput = 'I go to school yesterday.';
    await component.sendTextMessage();
    expect(component.grammarReview()).not.toBeNull();

    fixture.componentRef.setInput('id', 'room-2');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.grammarReview()).toBeNull();
  });

  it('keeps newer wording typed during the check instead of overwriting or sending it', async () => {
    let resolveGrammar: ((value: unknown) => void) | undefined;
    checkGrammar.mockReturnValue(
      new Promise((resolve) => {
        resolveGrammar = resolve;
      }),
    );
    component.textInput = 'I go to school yesterday.';

    const submission = component.sendTextMessage();
    component.textInput = 'I go to school yesterday. Then I';
    resolveGrammar?.(flagged);
    await submission;

    expect(component.textInput).toBe('I go to school yesterday. Then I');
    expect(component.grammarReview()).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(toastsSignal()).toHaveLength(0);
    expect(component.isCheckingGrammar()).toBe(false);
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
    expect(toastsSignal()).toHaveLength(0);
  });
});
