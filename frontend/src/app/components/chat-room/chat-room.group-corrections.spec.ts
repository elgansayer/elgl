import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ChatRoomComponent } from './chat-room.component';
import { applyChatRoomRealtimeEvent } from './chat-room-realtime';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    room_id: 'group-room',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Je suis aller au magasin',
    is_read: false,
    delivery_status: 'delivered',
    created_at: '2026-08-23T20:00:00.000Z',
    sender: { id: 'user-2', display_name: 'Camille', avatar_url: null },
    ...overrides,
  };
}

describe('ChatRoomComponent group corrections', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sendMessage = vi.fn();

    const chatService = {
      getRooms: vi.fn().mockResolvedValue([
        {
          id: 'group-room',
          title: 'French practice',
          subtitle: '',
          avatar: '',
          is_online: true,
          is_pinned: false,
          created_at: '2026-08-23T19:00:00.000Z',
          admin_id: 'user-1',
        },
      ]),
      getGroupMembers: vi.fn().mockResolvedValue([
        { user_id: 'user-1', user: { id: 'user-1', display_name: 'Me' } },
        { user_id: 'user-2', user: { id: 'user-2', display_name: 'Camille' } },
        { user_id: 'user-3', user: { id: 'user-3', display_name: 'Akira' } },
      ]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage,
      addFavourite: vi.fn().mockResolvedValue(undefined),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
      translateText: vi.fn(),
      markMessageStatus: vi.fn().mockResolvedValue(undefined),
    };

    const centrifugeService = {
      isConnected: signal(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      unsubscribe: vi.fn(),
    };

    const authService = {
      currentUser: signal({ id: 'user-1', display_name: 'Me' }),
      getAccessToken: vi.fn().mockReturnValue('token'),
      unlockApp: vi.fn().mockResolvedValue(undefined),
      appLocked: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: CentrifugeService, useValue: centrifugeService },
        { provide: AuthService, useValue: authService },
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
            getUserProfile: vi.fn().mockResolvedValue({ native_languages: ['fr'] }),
            getMyProfile: vi.fn().mockResolvedValue({ auto_play_voice_notes: false }),
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
              original: '',
              corrected: '',
              explanation: '',
              errors_found: 0,
            }),
          },
        },
        { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
        { provide: TextToSpeechService, useValue: { speak: vi.fn() } },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'group-room');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('prefills the correction composer from another group member message', () => {
    const source = makeMessage();

    component.startCorrection(source);

    expect(component.showCorrectionForm()).toBe(true);
    expect(component.originalText).toBe('Je suis aller au magasin');
    expect(component.correctedText).toBe('');
    expect(component.explanationText).toBe('');
  });

  it('broadcasts a visual correction to the same group room and preserves its explanation', async () => {
    const source = makeMessage();
    const saved = makeMessage({
      id: 'correction-1',
      sender_id: 'user-1',
      message_type: 'correction',
      text_content: undefined,
      correction_payload: {
        original: 'Je suis aller au magasin',
        corrected: 'Je suis allé au magasin',
        explanation: 'Use the past participle allé after être.',
      },
    });
    sendMessage.mockResolvedValue(saved);

    component.startCorrection(source);
    component.correctedText = 'Je suis allé au magasin';
    component.explanationText = 'Use the past participle allé after être.';

    await component.sendCorrection();

    expect(sendMessage).toHaveBeenCalledWith({
      room_id: 'group-room',
      message_type: 'correction',
      correction_payload: {
        original: 'Je suis aller au magasin',
        corrected: 'Je suis allé au magasin',
        explanation: 'Use the past participle allé after être.',
      },
    });
    expect(component.messages()).toContainEqual(saved);
    expect(component.showCorrectionForm()).toBe(false);
    expect(component.originalText).toBe('');
    expect(component.correctedText).toBe('');
    expect(component.explanationText).toBe('');
  });

  it('keeps the group correction draft open when persistence fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMessage.mockRejectedValue(new Error('temporary backend failure'));

    component.startCorrection(makeMessage());
    component.correctedText = 'Je suis allé au magasin';
    component.explanationText = 'Past participle agreement.';

    await component.sendCorrection();

    expect(component.showCorrectionForm()).toBe(true);
    expect(component.originalText).toBe('Je suis aller au magasin');
    expect(component.correctedText).toBe('Je suis allé au magasin');
    expect(component.explanationText).toBe('Past participle agreement.');
  });
});

describe('group correction realtime contract', () => {
  it('delivers another member correction to every client in the room without duplicating it', () => {
    const correction = makeMessage({
      id: 'correction-2',
      sender_id: 'user-3',
      message_type: 'correction',
      correction_payload: {
        original: 'I have went',
        corrected: 'I have gone',
        explanation: 'Use the past participle after have.',
      },
    });

    const first = applyChatRoomRealtimeEvent([], { message: correction }, 'group-room', 'user-1');
    const replay = applyChatRoomRealtimeEvent(
      first.messages,
      { message: correction },
      'group-room',
      'user-1',
    );

    expect(first.messages).toEqual([correction]);
    expect(first.incomingMessageToMarkRead?.id).toBe('correction-2');
    expect(replay.messages).toHaveLength(1);
    expect(replay.messages[0].correction_payload).toEqual(correction.correction_payload);
  });

  it('rejects a correction event from another room', () => {
    const correction = makeMessage({
      id: 'correction-other-room',
      room_id: 'different-room',
      message_type: 'correction',
      correction_payload: { original: 'a', corrected: 'b' },
    });

    const result = applyChatRoomRealtimeEvent([], { message: correction }, 'group-room', 'user-1');

    expect(result.messages).toEqual([]);
    expect(result.incomingMessageToMarkRead).toBeNull();
  });
});
