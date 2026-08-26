import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { FavouriteService } from '../../services/favourite.service';
import { I18nService } from '../../services/i18n.service';
import { NlpService } from '../../services/nlp.service';
import { SafetyService } from '../../services/safety.service';
import { ChatMessageComponent } from './chat-message.component';

describe('ChatMessageComponent voice playback contract', () => {
  let fixture: ComponentFixture<ChatMessageComponent>;

  beforeEach(async () => {
    const blockedUserIds = signal<ReadonlySet<string>>(new Set());

    await TestBed.configureTestingModule({
      imports: [ChatMessageComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ id: 'viewer-id' }),
            getAccessToken: vi.fn().mockReturnValue('access-token'),
          },
        },
        {
          provide: FavouriteService,
          useValue: { addFavourite: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SafetyService,
          useValue: {
            blockedUserIdsSignal: blockedUserIds.asReadonly(),
            blockUser: vi.fn().mockResolvedValue(undefined),
            unblockUser: vi.fn().mockResolvedValue(undefined),
            reportUser: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfirmService,
          useValue: { confirm: vi.fn().mockResolvedValue(false) },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        {
          provide: NlpService,
          useValue: {
            simplifyText: vi.fn(),
            explainGrammar: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatMessageComponent);
    fixture.componentRef.setInput('message', {
      id: 'message-id',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'text',
      text_content: 'hello',
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setVoiceMessage(mediaUrl = 'https://example.com/voice.webm'): void {
    fixture.componentInstance.voiceTranscription.set('Transcript');
    fixture.componentRef.setInput('message', {
      id: 'voice-message-id',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'voice',
      media_url: mediaUrl,
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();
  }

  it('keeps the supported speed cycle bounded to 1x, 1.5x, and 2x', () => {
    const component = fixture.componentInstance;

    expect(component.playbackSpeed()).toBe(1);
    component.cycleVoicePlaybackSpeed();
    expect(component.playbackSpeed()).toBe(1.5);
    component.cycleVoicePlaybackSpeed();
    expect(component.playbackSpeed()).toBe(2);
    component.cycleVoicePlaybackSpeed();
    expect(component.playbackSpeed()).toBe(1);
  });

  it('applies the selected speed when playback starts and while it is active', () => {
    const audio = {
      playbackRate: 1,
      addEventListener: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
    };
    const AudioMock = vi.fn(function AudioMock() {
      return audio;
    });
    vi.stubGlobal('Audio', AudioMock);
    setVoiceMessage();

    fixture.componentInstance.cycleVoicePlaybackSpeed();
    fixture.componentInstance.playVoice();

    expect(audio.playbackRate).toBe(1.5);
    expect(audio.play).toHaveBeenCalledOnce();

    fixture.componentInstance.cycleVoicePlaybackSpeed();
    expect(audio.playbackRate).toBe(2);
  });

  it('releases the failed audio instance so a later speed change does not mutate it', async () => {
    const playbackError = new Error('browser rejected playback');
    const audio = {
      playbackRate: 1,
      addEventListener: vi.fn(),
      play: vi.fn().mockRejectedValue(playbackError),
    };
    const AudioMock = vi.fn(function AudioMock() {
      return audio;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('Audio', AudioMock);
    setVoiceMessage();

    fixture.componentInstance.playVoice();
    await Promise.resolve();
    await Promise.resolve();

    fixture.componentInstance.cycleVoicePlaybackSpeed();

    expect(audio.playbackRate).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(playbackError);
  });

  it('releases an ended audio instance before later speed changes', () => {
    let ended: (() => void) | undefined;
    const audio = {
      playbackRate: 1,
      addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
        if (event === 'ended' && typeof listener === 'function') ended = listener as () => void;
      }),
      play: vi.fn().mockResolvedValue(undefined),
    };
    const AudioMock = vi.fn(function AudioMock() {
      return audio;
    });
    vi.stubGlobal('Audio', AudioMock);
    setVoiceMessage();

    fixture.componentInstance.playVoice();
    expect(ended).toBeTypeOf('function');
    ended?.();
    fixture.componentInstance.cycleVoicePlaybackSpeed();

    expect(audio.playbackRate).toBe(1);
  });

  it('does not construct an audio player when a voice message has no media URL', () => {
    const AudioMock = vi.fn();
    vi.stubGlobal('Audio', AudioMock);
    setVoiceMessage('');

    fixture.componentInstance.playVoice();

    expect(AudioMock).not.toHaveBeenCalled();
  });
});
