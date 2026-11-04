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
import { toastsSignal } from '../../services/toast.service';
import { LinkPreviewCardComponent } from '../link-preview-card/link-preview-card.component';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { ChatSystemBubbleComponent } from '../chat-system-bubble/chat-system-bubble.component';
import { ChatMessageComponent } from './chat-message.component';
import { GiftAnimationComponent } from '../gift-animation/gift-animation.component';

describe('ChatMessageComponent', () => {
  let fixture: ComponentFixture<ChatMessageComponent>;
  let currentUser: ReturnType<typeof vi.fn>;
  let addFavourite: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    addFavourite = vi.fn().mockResolvedValue({ success: true });
    toastsSignal.set([]);
    const blockedUserIds = signal<ReadonlySet<string>>(new Set());
    currentUser = vi.fn().mockReturnValue({ id: 'viewer-id' });

    await TestBed.configureTestingModule({
      imports: [ChatMessageComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser,
            getAccessToken: vi.fn().mockReturnValue('access-token'),
          },
        },
        {
          provide: FavouriteService,
          useValue: { addFavourite },
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
    toastsSignal.set([]);
  });

  describe('favouriting a message', () => {
    const event = { messageId: 'message-id', content: 'A complex sentence', messageType: 'text' };

    it('saves the message by id only and confirms with a translated success toast', async () => {
      await fixture.componentInstance.onFavourite(event);

      expect(addFavourite).toHaveBeenCalledWith({ message_id: 'message-id' });
      expect(toastsSignal()).toEqual([
        expect.objectContaining({ type: 'success', message: 'chatRoom.bookmarkSuccess' }),
      ]);
    });

    it('tells the user when the message could not be saved instead of failing silently', async () => {
      addFavourite.mockRejectedValueOnce(new Error('offline'));

      await expect(fixture.componentInstance.onFavourite(event)).resolves.toBeUndefined();

      expect(toastsSignal()).toEqual([
        expect.objectContaining({ type: 'error', message: 'chatRoom.bookmarkError' }),
      ]);
    });

    it('is wired to the context menu favourite action', async () => {
      const menu = fixture.debugElement.query(By.directive(LongPressContextMenuComponent));

      menu.componentInstance.favourite.emit(event);
      await fixture.whenStable();

      expect(addFavourite).toHaveBeenCalledWith({ message_id: 'message-id' });
    });
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

  it('renders the backend-provided rich link preview for text messages', () => {
    fixture.componentRef.setInput('message', {
      id: 'message-id',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'text',
      text_content: 'Read https://example.com/article',
      link_preview: {
        url: 'https://example.com/article',
        title: 'Example article',
        description: 'A useful preview',
        image: 'https://example.com/preview.jpg',
        siteName: 'Example',
      },
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();

    const preview = fixture.debugElement.query(By.directive(LinkPreviewCardComponent));
    expect(preview).toBeTruthy();
    expect(preview.componentInstance.url()).toBe('https://example.com/article');
    expect(preview.componentInstance.title()).toBe('Example article');
    expect(preview.componentInstance.description()).toBe('A useful preview');
    expect(preview.componentInstance.image()).toBe('https://example.com/preview.jpg');
    expect(preview.componentInstance.siteName()).toBe('Example');
  });

  it('does not render a rich link preview when the message has no preview payload', () => {
    expect(fixture.debugElement.query(By.directive(LinkPreviewCardComponent))).toBeNull();
  });

  it('gives a received doodle a translated text alternative instead of a hard-coded label', () => {
    fixture.componentRef.setInput('message', {
      id: 'doodle-message-id',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'doodle',
      media_url: 'https://cdn.example/chat-media/sender-id/doodle/standard/1-a.png',
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
      sender: { id: 'sender-id', display_name: 'Ayaka' },
    });
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe(
      'https://cdn.example/chat-media/sender-id/doodle/standard/1-a.png',
    );
    expect(image.getAttribute('alt')).toBe('chatRoom.doodleAlt');
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('renders system events with the dedicated bubble and no user-message actions', () => {
    fixture.componentRef.setInput('message', {
      id: 'system-message-id',
      room_id: 'room-id',
      sender_id: '',
      message_type: 'system',
      system_event: { type: 'profileUpdated', name: 'Language Partner' },
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();

    const bubble = fixture.debugElement.query(By.directive(ChatSystemBubbleComponent));
    expect(bubble).toBeTruthy();
    expect(bubble.componentInstance.eventType()).toBe('profileUpdated');
    expect(bubble.componentInstance.params()).toEqual({
      type: 'profileUpdated',
      name: 'Language Partner',
    });
    expect(fixture.debugElement.query(By.directive(LongPressContextMenuComponent))).toBeNull();
  });

  it('uses the generic system bubble fallback for a malformed system message', () => {
    fixture.componentRef.setInput('message', {
      id: 'system-message-id',
      room_id: 'room-id',
      sender_id: '',
      message_type: 'system',
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    fixture.detectChanges();

    const bubble = fixture.debugElement.query(By.directive(ChatSystemBubbleComponent));
    expect(bubble).toBeTruthy();
    expect(bubble.componentInstance.i18nKey()).toBe('notifications.systemAlert');
    expect(fixture.debugElement.query(By.directive(LongPressContextMenuComponent))).toBeNull();
  });

  it('renders gift messages through the shared gift animation component', async () => {
    fixture.componentRef.setInput('message', {
      id: 'gift-message',
      room_id: 'room-id',
      sender_id: 'sender-id',
      message_type: 'gift',
      gift_payload: {
        gift_id: 'gift_rose',
        gift_name: 'Rose',
        gift_icon: '🌹',
        coin_value: 10,
        animation_type: 'float',
      },
      is_read: false,
      created_at: '2026-08-18T12:00:00.000Z',
    });
    await fixture.whenStable();

    const gift = fixture.debugElement.query(By.directive(GiftAnimationComponent));
    expect(gift).toBeTruthy();
    expect(gift.componentInstance.giftPayload()).toMatchObject({
      gift_id: 'gift_rose',
      coin_value: 10,
    });
  });

  it('updates memoized message ownership when the current user input changes', () => {
    const component = fixture.componentInstance;

    expect(component.isOwnMessage()).toBe(false);
    // Child components may also read the session; memoisation means repeated
    // ownership reads add no further currentUser() calls.
    const callsAfterRender = currentUser.mock.calls.length;

    component.isOwnMessage();
    component.isOwnMessage();
    expect(currentUser).toHaveBeenCalledTimes(callsAfterRender);

    fixture.componentRef.setInput('currentUserId', 'sender-id');
    fixture.detectChanges();
    expect(component.isOwnMessage()).toBe(true);

    fixture.componentRef.setInput('currentUserId', 'another-user');
    fixture.detectChanges();
    expect(component.isOwnMessage()).toBe(false);
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
