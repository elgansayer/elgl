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

/**
 * The Playwright chat suite (e2e/tests/chat-messaging.spec.ts) drives the composer through this
 * test id. Pinning it against the rendered DOM makes a template refactor fail in the frontend unit
 * gate instead of surfacing later as a 30 second locator.fill() timeout in browser QA.
 */
const composerSelector = '[data-testid="chat-message-input"]';
const removedComposerSelectors = [
  '[data-testid="message-input"]',
  '.message-input',
  '#message-input',
];

function makeSentMessage(text: string): ChatMessage {
  return {
    id: 'sent-1',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'text',
    text_content: text,
    is_read: true,
    created_at: '2026-08-25T12:01:00.000Z',
    sender: { id: 'user-1', display_name: 'Me', avatar_url: null },
  };
}

describe('ChatRoomComponent composer E2E locator contract', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;

  function composerInput(): HTMLInputElement {
    const element = fixture.nativeElement.querySelector(composerSelector);
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`${composerSelector} must resolve to a native <input> for Playwright fill()`);
    }
    return element;
  }

  beforeEach(async () => {
    sendMessage = vi
      .fn()
      .mockImplementation((request: { text_content?: string }) =>
        Promise.resolve(makeSentMessage(request.text_content ?? '')),
      );

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
            getWordStatus: vi.fn().mockReturnValue({ colourClass: '' }),
            checkGrammar: vi.fn().mockImplementation((text: string) =>
              Promise.resolve({
                original: text,
                corrected: text,
                explanation: 'No corrections needed.',
                errors_found: 0,
              }),
            ),
          },
        },
        {
          provide: DraftService,
          useValue: {
            saveChatDraft: vi.fn(),
            loadChatDraft: vi.fn().mockReturnValue(''),
            clearChatDraft: vi.fn(),
            saveChatDraftV2: vi.fn(),
            loadChatDraftV2: vi.fn().mockReturnValue(null),
            clearChatDraftV2: vi.fn(),
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

  it('renders exactly one editable native input for the canonical Playwright locator', () => {
    expect(fixture.nativeElement.querySelectorAll(composerSelector)).toHaveLength(1);

    const input = composerInput();

    expect(input.type).toBe('text');
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(false);
  });

  it('does not keep a compatibility alias for the removed message-input locators', () => {
    for (const selector of removedComposerSelectors) {
      expect(fixture.nativeElement.querySelector(selector), selector).toBeNull();
    }
  });

  it('sends typed text on Enter and clears the field like the browser chat flow', async () => {
    const text = '日本語を毎日れんしゅうしています。';
    const input = composerInput();

    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.textInput).toBe(text);

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: 'room-1', message_type: 'text', text_content: text }),
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(composerInput().value).toBe('');
    });
    expect(component.textInput).toBe('');
  });
});
