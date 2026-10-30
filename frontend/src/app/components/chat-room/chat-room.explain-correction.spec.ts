import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { NlpService } from '../../services/nlp.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { ChatRoomComponent } from './chat-room.component';

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'text-1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'I has a cat',
    is_read: true,
    created_at: '2026-10-30T09:00:00.000Z',
    sender: { id: 'user-2', display_name: 'Emma', avatar_url: null },
    ...overrides,
  };
}

const textMessage = makeMessage({});
const correctionMessage = makeMessage({
  id: 'correction-1',
  sender_id: 'user-1',
  message_type: 'correction',
  text_content: undefined,
  correction_payload: {
    original: 'I has a cat',
    corrected: 'I have a cat',
    explanation: 'Use have with I.',
  },
  sender: { id: 'user-1', display_name: 'Me', avatar_url: null },
});

describe('ChatRoomComponent corrected-text grammar explanation', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let explainGrammar: ReturnType<typeof vi.fn>;

  const contextMenus = (): LongPressContextMenuComponent[] =>
    fixture.debugElement
      .queryAll(By.directive(LongPressContextMenuComponent))
      .map((element) => element.componentInstance);

  const menuDialog = (): Element | null => document.body.querySelector('[role="dialog"]');

  const buttonLabelled = (label: string): HTMLButtonElement | undefined =>
    Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
      (button): button is HTMLButtonElement => button.textContent?.trim() === label,
    );

  beforeEach(async () => {
    explainGrammar = vi.fn().mockResolvedValue({
      original: 'I has a cat',
      corrected: 'I have a cat',
      explanation: 'Use "have" with "I" because "has" is the third person singular form.',
    });

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getRooms: vi.fn().mockResolvedValue([]),
            getGroupMembers: vi.fn().mockResolvedValue([]),
            getMessages: vi.fn().mockResolvedValue([textMessage, correctionMessage]),
            sendMessage: vi.fn(),
            addFavourite: vi.fn().mockResolvedValue(undefined),
            lockChat: vi.fn().mockResolvedValue(undefined),
            unlockChat: vi.fn().mockResolvedValue(undefined),
            translateText: vi.fn(),
            markMessageStatus: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            isConnected: signal(false),
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockReturnValue({}),
            unsubscribe: vi.fn(),
            listen: vi.fn().mockReturnValue(() => undefined),
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
            getWordStatus: vi.fn().mockReturnValue({ level: 0, colorClass: '', colourClass: '' }),
            translateWordOrSentence: vi.fn(),
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
            checkGrammar: vi.fn().mockResolvedValue({
              original: '',
              corrected: '',
              explanation: '',
              errors_found: 0,
            }),
          },
        },
        { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
        { provide: TextToSpeechService, useValue: { speak: vi.fn() } },
        { provide: NlpService, useValue: { explainGrammar, simplifyText: vi.fn() } },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    fixture.componentRef.setInput('id', 'room-1');
    fixture.detectChanges();
    // Room loading is a chain of plain promises that whenStable() does not track.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(contextMenus()).toHaveLength(2);
    });
  });

  it('gives a correction message its original and corrected text but not a plain text message', () => {
    const [textMenu, correctionMenu] = contextMenus();

    expect(contextMenus()).toHaveLength(2);
    expect(textMenu.correctionOriginal()).toBeNull();
    expect(textMenu.correctionCorrected()).toBeNull();
    expect(textMenu.canExplainCorrection()).toBe(false);

    expect(correctionMenu.messageType()).toBe('correction');
    expect(correctionMenu.correctionOriginal()).toBe('I has a cat');
    expect(correctionMenu.correctionCorrected()).toBe('I have a cat');
    expect(correctionMenu.canExplainCorrection()).toBe(true);
  });

  it('offers Explain this on the corrected message in the live room and not on text messages', async () => {
    const [textMenu, correctionMenu] = contextMenus();

    textMenu.openMenu();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(menuDialog()?.textContent).not.toContain('Explain this');
    textMenu.closeMenu();
    await fixture.whenStable();
    fixture.detectChanges();

    correctionMenu.openMenu();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttonLabelled('Explain this')).toBeDefined();
  });

  it('explains the correction from the live room and shows the AI breakdown', async () => {
    const [, correctionMenu] = contextMenus();
    correctionMenu.openMenu();
    await fixture.whenStable();
    fixture.detectChanges();

    buttonLabelled('Explain this')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(explainGrammar).toHaveBeenCalledOnce();
    expect(explainGrammar).toHaveBeenCalledWith(
      { original: 'I has a cat', corrected: 'I have a cat' },
      expect.any(AbortSignal),
    );
    const dialog = Array.from(document.body.querySelectorAll('[role="dialog"]')).find((element) =>
      element.textContent?.includes('Grammar explanation'),
    );
    expect(dialog?.textContent).toContain(
      'Use "have" with "I" because "has" is the third person singular form.',
    );
  });
});
