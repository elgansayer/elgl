import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { FavouriteService } from '../../services/favourite.service';
import { I18nService } from '../../services/i18n.service';
import { NlpService } from '../../services/nlp.service';
import { SafetyService } from '../../services/safety.service';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { ChatMessageComponent } from './chat-message.component';

describe('ChatMessageComponent', () => {
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
      text_content: 'A complex sentence',
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates simplification to the shared context menu without an inline action', () => {
    const menu = fixture.debugElement.query(By.directive(LongPressContextMenuComponent));

    expect(menu).toBeTruthy();
    expect(menu.componentInstance.messageContent()).toBe('A complex sentence');
    const buttonLabels = fixture.debugElement
      .queryAll(By.css('button'))
      .map((button) => button.nativeElement.textContent.trim());
    expect(buttonLabels).toContain('context_menu.open');
    expect(buttonLabels).not.toContain('chatRoom.simplifyBtn');
  });

  it('cycles voice playback speed through 1x, 1.5x, and 2x', () => {
    const component = fixture.componentInstance;

    expect(component.playbackSpeed()).toBe(1);
    component.cycleVoicePlaybackSpeed();
    expect(component.playbackSpeed()).toBe(1.5);
    component.cycleVoicePlaybackSpeed();
    expect(component.playbackSpeed()).toBe(2);
    component.cycleVoicePlaybackSpeed();
    expect(component.playbackSpeed()).toBe(1);
  });

  it('applies the selected speed to voice playback and updates active audio', () => {
    const audio = {
      playbackRate: 1,
      addEventListener: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
    };
    // The component calls `new Audio(...)`, and arrow functions have no
    // [[Construct]] slot - vitest's mock invokes the implementation via
    // Reflect.construct when called with `new`, which throws for an arrow
    // function implementation. A plain function expression is constructible.
    const AudioMock = vi.fn(function AudioMock() {
      return audio;
    });
    vi.stubGlobal('Audio', AudioMock);

    fixture.componentRef.setInput('message', {
      id: 'voice-message-id',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'voice',
      media_url: 'https://example.com/voice.webm',
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.componentInstance.voiceTranscription.set('Transcript');
    fixture.detectChanges();

    fixture.componentInstance.cycleVoicePlaybackSpeed();
    fixture.componentInstance.playVoice();

    expect(AudioMock).toHaveBeenCalledWith('https://example.com/voice.webm');
    expect(audio.playbackRate).toBe(1.5);
    expect(audio.play).toHaveBeenCalledOnce();

    fixture.componentInstance.cycleVoicePlaybackSpeed();
    expect(audio.playbackRate).toBe(2);
  });

  it('renders a touch-sized speed control for voice messages', () => {
    fixture.componentRef.setInput('message', {
      id: 'voice-message-id',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'voice',
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();

    const speedButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) => button.nativeElement.textContent.trim() === '1×');

    expect(speedButton).toBeTruthy();
    expect(speedButton?.nativeElement.getAttribute('type')).toBe('button');
    expect(speedButton?.nativeElement.getAttribute('aria-label')).toContain('1×');
  });
});
