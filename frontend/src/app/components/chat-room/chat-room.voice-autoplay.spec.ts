import { signal } from '@angular/core';
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
import { ChatRoomComponent } from './chat-room.component';

function message(
  id: string,
  type: ChatMessage['message_type'],
  mediaUrl?: string,
): ChatMessage {
  return {
    id,
    room_id: 'room-1',
    sender_id: 'partner-1',
    message_type: type,
    media_url: mediaUrl,
    text_content: type === 'text' ? `message ${id}` : undefined,
    is_read: true,
    created_at: '2026-08-23T09:00:00.000Z',
    sender: { id: 'partner-1', display_name: 'Partner', avatar_url: null },
  };
}

describe('ChatRoomComponent sequential voice-note autoplay', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let getMyProfile: ReturnType<typeof vi.fn>;
  let playSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    getMyProfile = vi.fn().mockResolvedValue({ auto_play_voice_notes: true });
    playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());

    const chatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getGroupMembers: vi.fn().mockResolvedValue([]),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn(),
      addFavourite: vi.fn().mockResolvedValue(undefined),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
      translateText: vi.fn(),
      markMessageStatus: vi.fn().mockResolvedValue(undefined),
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
      getMyProfile,
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
      getWordStatus: vi.fn().mockReturnValue(undefined),
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

  it('loads the persisted autoplay preference for the signed-in user', async () => {
    await vi.waitFor(() => expect(getMyProfile).toHaveBeenCalled());
    expect(component.autoPlayVoiceNotes()).toBe(true);
  });

  it('plays the next playable voice note after the current note ends', async () => {
    component.autoPlayVoiceNotes.set(true);
    component.isLoading.set(false);
    component.messages.set([
      message('voice-1', 'voice', 'https://media.example/one.webm'),
      message('text-1', 'text'),
      message('voice-2', 'voice', 'https://media.example/two.webm'),
      message('voice-3', 'voice', 'https://media.example/three.webm'),
    ]);
    fixture.detectChanges();

    await component.playNextVoiceNote('voice-1');

    expect(playSpy).toHaveBeenCalledTimes(1);
    const secondAudio = fixture.nativeElement.querySelector('#audio-voice-2') as HTMLAudioElement;
    expect(playSpy.mock.instances[0]).toBe(secondAudio);
  });

  it('skips voice records that do not have playable media', async () => {
    component.autoPlayVoiceNotes.set(true);
    component.isLoading.set(false);
    component.messages.set([
      message('voice-1', 'voice', 'https://media.example/one.webm'),
      message('voice-empty', 'voice'),
      message('voice-2', 'voice', 'https://media.example/two.webm'),
    ]);
    fixture.detectChanges();

    await component.playNextVoiceNote('voice-1');

    expect(playSpy).toHaveBeenCalledTimes(1);
    const secondAudio = fixture.nativeElement.querySelector('#audio-voice-2') as HTMLAudioElement;
    expect(playSpy.mock.instances[0]).toBe(secondAudio);
  });

  it('does not start another note while autoplay is disabled', async () => {
    component.autoPlayVoiceNotes.set(false);
    component.isLoading.set(false);
    component.messages.set([
      message('voice-1', 'voice', 'https://media.example/one.webm'),
      message('voice-2', 'voice', 'https://media.example/two.webm'),
    ]);
    fixture.detectChanges();

    await component.playNextVoiceNote('voice-1');

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stops safely when browser autoplay policy rejects the next playback', async () => {
    playSpy.mockRejectedValueOnce(new DOMException('Playback blocked', 'NotAllowedError'));
    component.autoPlayVoiceNotes.set(true);
    component.isLoading.set(false);
    component.messages.set([
      message('voice-1', 'voice', 'https://media.example/one.webm'),
      message('voice-2', 'voice', 'https://media.example/two.webm'),
    ]);
    fixture.detectChanges();

    await expect(component.playNextVoiceNote('voice-1')).resolves.toBeUndefined();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing for stale or unknown current message ids', async () => {
    component.autoPlayVoiceNotes.set(true);
    component.isLoading.set(false);
    component.messages.set([message('voice-2', 'voice', 'https://media.example/two.webm')]);
    fixture.detectChanges();

    await component.playNextVoiceNote('missing-message');

    expect(playSpy).not.toHaveBeenCalled();
  });
});
