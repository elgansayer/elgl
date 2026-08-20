import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatRoomComponent } from './chat-room.component';
import { ChatService } from '../../services/chat.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { TypingService } from '../../services/typing.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { NetworkStatusService } from '../../services/network-status.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { I18nService } from '../../services/i18n.service';

describe('ChatRoomComponent conversation starters', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let chatService: {
    getRooms: ReturnType<typeof vi.fn>;
    getGroupMembers: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    getConversationStarters: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    chatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      getConversationStarters: vi.fn().mockResolvedValue([
        'What got you into hiking?',
        'What are you practising this week?',
        'What is your favourite place to visit?',
      ]),
      sendMessage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
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
            getAccessToken: vi.fn().mockReturnValue('token'),
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

    component.isLoading.set(false);
    component.messages.set([]);
    component.participants.set([
      { user_id: 'user-1', user: { id: 'user-1', display_name: 'Me' } },
      { user_id: 'user-2', user: { id: 'user-2', display_name: 'Mika' } },
    ]);
    component.composerHasText.set(false);
    component.conversationStartersDismissed.set(false);
  });

  it('requests suggestions only for an empty direct chat and deduplicates repeat loads', async () => {
    await component.loadConversationStarters();
    await component.loadConversationStarters();

    expect(chatService.getConversationStarters).toHaveBeenCalledTimes(1);
    expect(chatService.getConversationStarters).toHaveBeenCalledWith('user-2');
    expect(component.conversationStarters()).toHaveLength(3);
  });

  it('does not request suggestions once the conversation already has messages', async () => {
    component.messages.set([
      {
        id: 'message-1',
        room_id: 'room-1',
        sender_id: 'user-2',
        message_type: 'text',
        text_content: 'Hello',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);

    await component.loadConversationStarters();

    expect(chatService.getConversationStarters).not.toHaveBeenCalled();
    expect(component.showConversationStarters()).toBe(false);
  });

  it('does not request suggestions for group chats', async () => {
    component.participants.update((members) => [
      ...members,
      { user_id: 'user-3', user: { id: 'user-3', display_name: 'Third member' } },
    ]);

    await component.loadConversationStarters();

    expect(chatService.getConversationStarters).not.toHaveBeenCalled();
  });

  it('selecting a suggestion fills the composer without sending it', async () => {
    await component.loadConversationStarters();
    const suggestion = component.conversationStarters()[0];

    component.selectConversationStarter(suggestion);

    expect(component.textInput).toBe(suggestion);
    expect(component.composerHasText()).toBe(true);
    expect(component.conversationStartersDismissed()).toBe(true);
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('hides starters as soon as the user starts composing', async () => {
    await component.loadConversationStarters();
    expect(component.showConversationStarters()).toBe(true);

    const input = document.createElement('input');
    input.value = 'H';
    input.setSelectionRange(1, 1);
    component.onComposerInput({ target: input } as unknown as Event);

    expect(component.showConversationStarters()).toBe(false);
    expect(component.conversationStartersDismissed()).toBe(true);
  });

  it('renders keyboard-native suggestion buttons with accessible hit targets', async () => {
    await component.loadConversationStarters();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="conversation-starter"]'),
    ) as HTMLButtonElement[];

    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.tagName === 'BUTTON')).toBe(true);
    expect(buttons.every((button) => button.type === 'button')).toBe(true);
    expect(buttons.every((button) => button.className.includes('min-h-11'))).toBe(true);
  });

  it('exposes an error state when the starter request fails', async () => {
    chatService.getConversationStarters.mockRejectedValueOnce(new Error('network'));

    await component.loadConversationStarters();
    fixture.detectChanges();

    expect(component.conversationStartersError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
