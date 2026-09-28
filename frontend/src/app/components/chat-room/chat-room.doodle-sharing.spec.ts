import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { DoodlePadComponent } from '../doodle-pad/doodle-pad.component';
import { ChatRoomComponent } from './chat-room.component';

function doodleMessage(dataUrl: string): ChatMessage {
  return {
    id: 'doodle-message-1',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'doodle',
    media_url: dataUrl,
    text_content: 'Doodle',
    is_read: true,
    created_at: '2026-08-22T12:00:00.000Z',
    sender: { id: 'user-1', display_name: 'Me', avatar_url: null },
  };
}

describe('ChatRoomComponent doodle sharing contract', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sendMessage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const chatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage,
      addFavourite: vi.fn().mockResolvedValue(undefined),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
      translateText: vi.fn(),
    };
    const authService = {
      currentUser: signal({ id: 'user-1', display_name: 'Me' }),
      getAccessToken: vi.fn().mockReturnValue('access-token'),
      unlockApp: vi.fn().mockResolvedValue(undefined),
      appLocked: signal(false),
    };
    const centrifugeService = {
      isConnected: signal(false),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      unsubscribe: vi.fn(),
    };
    const safetyService = {
      getBlockedIdsAsync: vi.fn().mockResolvedValue([]),
      getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
      blockedUserIdsSignal: signal(new Set<string>()),
    };
    const userService = {
      getUserProfile: vi.fn().mockResolvedValue(null),
      getMyProfile: vi.fn().mockResolvedValue(null),
    };
    const typingService = {
      typingUsers: signal([]),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTyping: vi.fn(),
    };
    const vocabularyStore = {
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

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: CentrifugeService, useValue: centrifugeService },
        { provide: AuthService, useValue: authService },
        { provide: SafetyService, useValue: safetyService },
        { provide: UserService, useValue: userService },
        { provide: TypingService, useValue: typingService },
        { provide: VocabularyStore, useValue: vocabularyStore },
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
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens and cancels the owned doodle pad from the chat-room modal contract', () => {
    component.showDoodleModal.set(true);
    fixture.detectChanges();

    const doodlePad = fixture.debugElement.query(By.directive(DoodlePadComponent));
    expect(doodlePad).toBeTruthy();

    (doodlePad.componentInstance as DoodlePadComponent).cancelled.emit();
    fixture.detectChanges();

    expect(component.showDoodleModal()).toBe(false);
    expect(fixture.debugElement.query(By.directive(DoodlePadComponent))).toBeNull();
  });

  it('sends the saved PNG data URL as a doodle message and appends it once', async () => {
    const dataUrl = 'data:image/png;base64,dGVzdC1kb29kbGU=';
    const sent = doodleMessage(dataUrl);
    sendMessage.mockResolvedValue(sent);
    component.showDoodleModal.set(true);

    await component.onDoodleSaved(dataUrl);

    expect(component.showDoodleModal()).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'room-1',
        message_type: 'doodle',
        media_url: dataUrl,
      }),
    );
    expect(component.messages()).toEqual([sent]);

    await component.onDoodleSaved(dataUrl);
    expect(component.messages()).toEqual([sent]);
  });

  it('keeps the conversation usable when doodle persistence fails', async () => {
    const failure = new Error('doodle upload failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMessage.mockRejectedValueOnce(failure);
    component.showDoodleModal.set(true);

    await expect(
      component.onDoodleSaved('data:image/png;base64,dGVzdA=='),
    ).resolves.toBeUndefined();

    expect(component.showDoodleModal()).toBe(false);
    expect(component.messages()).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith('Failed to send doodle:', failure);
  });

  it('renders persisted doodle messages as images in the chat timeline', () => {
    const dataUrl = 'data:image/png;base64,dGVzdC1yZW5kZXI=';
    component.isLoading.set(false);
    component.messages.set([doodleMessage(dataUrl)]);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img[alt="doodle"]') as HTMLImageElement | null;
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toBe(dataUrl);
  });
});
