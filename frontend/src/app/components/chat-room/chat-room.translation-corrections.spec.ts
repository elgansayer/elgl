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

function textMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Bonjour tout le monde',
    is_read: false,
    created_at: '2026-08-24T10:00:00.000Z',
    ...overrides,
  };
}

describe('ChatRoomComponent translation and correction contract', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;
  let translateText: ReturnType<typeof vi.fn>;
  let cacheGet: ReturnType<typeof vi.fn>;
  let cacheSet: ReturnType<typeof vi.fn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    sendMessage = vi.fn();
    translateText = vi.fn();
    cacheGet = vi.fn().mockReturnValue(null);
    cacheSet = vi.fn();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

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
            translateText,
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
            getUserProfile: vi.fn().mockResolvedValue({ native_languages: ['fr-FR'] }),
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
            checkGrammar: vi.fn(),
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
            saveChatDraft: vi.fn(),
            saveChatDraftV2: vi.fn(),
            loadChatDraft: vi.fn().mockReturnValue(null),
            loadChatDraftV2: vi.fn().mockReturnValue(null),
            clearChatDraft: vi.fn(),
            clearChatDraftV2: vi.fn(),
          },
        },
        {
          provide: TranslationCacheService,
          useValue: { get: cacheGet, set: cacheSet, clear: vi.fn() },
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
    await Promise.resolve();
  });

  afterEach(() => {
    fixture.destroy();
    consoleError.mockRestore();
  });

  it('translates a message into the application language and caches the result', async () => {
    const message = textMessage();
    translateText.mockResolvedValue({
      original_text: message.text_content,
      translated_text: 'Hello everyone',
      target_language: 'en',
      detected_language: 'fr',
    });

    await component.toggleTranslation(message);

    expect(translateText).toHaveBeenCalledWith('Bonjour tout le monde', 'en');
    expect(cacheSet).toHaveBeenCalledWith('Bonjour tout le monde', 'en', 'Hello everyone');
    expect(component.translations()[message.id]).toBe('Hello everyone');
    expect(component.showTranslation()[message.id]).toBe(true);
  });

  it('uses a cached translation without sending private text to the provider again', async () => {
    const message = textMessage();
    cacheGet.mockReturnValue('Hello everyone');

    await component.toggleTranslation(message);

    expect(cacheGet).toHaveBeenCalledWith('Bonjour tout le monde', 'en');
    expect(translateText).not.toHaveBeenCalled();
    expect(component.translations()[message.id]).toBe('Hello everyone');
    expect(component.showTranslation()[message.id]).toBe(true);
  });

  it('toggles an already translated message without another network request', async () => {
    const message = textMessage();
    translateText.mockResolvedValue({ translated_text: 'Hello everyone' });

    await component.toggleTranslation(message);
    await component.toggleTranslation(message);
    await component.toggleTranslation(message);

    expect(translateText).toHaveBeenCalledTimes(1);
    expect(component.showTranslation()[message.id]).toBe(true);
  });

  it('keeps the original message visible and cache untouched when translation fails', async () => {
    const message = textMessage();
    translateText.mockRejectedValue(new Error('provider unavailable'));

    await component.toggleTranslation(message);

    expect(cacheSet).not.toHaveBeenCalled();
    expect(component.translations()[message.id]).toBeUndefined();
    expect(component.showTranslation()[message.id]).not.toBe(true);
  });

  it('opens correction editing only for text messages and preserves the source sentence', () => {
    const message = textMessage({ text_content: 'Je suis aller au parc.' });

    component.startCorrection(message);

    expect(component.originalText).toBe('Je suis aller au parc.');
    expect(component.correctedText).toBe(component.originalText);
    expect(component.explanationText).toBe('');
    expect(component.showCorrectionForm()).toBe(true);

    component.showCorrectionForm.set(false);
    component.startCorrection(textMessage({ message_type: 'voice', media_url: 'https://example.test/a.ogg' }));
    expect(component.showCorrectionForm()).toBe(false);
  });

  it('sends trimmed correction data and clears the editor only after persistence succeeds', async () => {
    const saved = textMessage({
      id: 'correction-1',
      sender_id: 'user-1',
      message_type: 'correction',
      text_content: undefined,
      correction_payload: {
        original: 'Je suis aller au parc.',
        corrected: 'Je suis allé au parc.',
        explanation: 'Use the past participle allé.',
      },
    });
    sendMessage.mockResolvedValue(saved);
    component.originalText = '  Je suis aller au parc.  ';
    component.correctedText = '  Je suis allé au parc.  ';
    component.explanationText = '  Use the past participle allé.  ';
    component.showCorrectionForm.set(true);

    await component.sendCorrection();

    expect(sendMessage).toHaveBeenCalledWith({
      room_id: 'room-1',
      message_type: 'correction',
      correction_payload: {
        original: 'Je suis aller au parc.',
        corrected: 'Je suis allé au parc.',
        explanation: 'Use the past participle allé.',
      },
    });
    expect(component.messages()).toContain(saved);
    expect(component.originalText).toBe('');
    expect(component.correctedText).toBe(component.originalText);
    expect(component.explanationText).toBe('');
    expect(component.showCorrectionForm()).toBe(false);
  });

  it('retains the complete correction draft when persistence fails so the learner can retry', async () => {
    sendMessage.mockRejectedValue(new Error('temporary write failure'));
    component.originalText = 'Original';
    component.correctedText = 'Corrected';
    component.explanationText = 'Explanation';
    component.showCorrectionForm.set(true);

    await component.sendCorrection();

    expect(component.originalText).toBe('Original');
    expect(component.correctedText).toBe('Corrected');
    expect(component.explanationText).toBe('Explanation');
    expect(component.showCorrectionForm()).toBe(true);
  });

  it('links correction requests to the source message without rewriting its text', async () => {
    const source = textMessage({ id: 'source-1', text_content: 'Can you check this sentence?' });
    const saved = textMessage({
      id: 'request-1',
      sender_id: 'user-1',
      message_type: 'correction_request',
      text_content: undefined,
      correction_request_payload: { original_text: source.text_content! },
      reply_to_id: source.id,
    });
    sendMessage.mockResolvedValue(saved);

    await component.requestCorrection(source);

    expect(sendMessage).toHaveBeenCalledWith({
      room_id: 'room-1',
      message_type: 'correction_request',
      correction_request_payload: { original_text: 'Can you check this sentence?' },
      reply_to_id: 'source-1',
    });
    expect(component.messages()).toContain(saved);
  });
});
