import { signal, type WritableSignal } from '@angular/core';
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
import { ChatMessageComponent } from './chat-message.component';

describe('ChatMessageComponent', () => {
  let fixture: ComponentFixture<ChatMessageComponent>;
  let currentUser: ReturnType<typeof vi.fn>;
  let blockedUserIds: WritableSignal<ReadonlySet<string>>;
  let safety: {
    blockUserAsync: ReturnType<typeof vi.fn>;
    unblockUserAsync: ReturnType<typeof vi.fn>;
    reportUser: ReturnType<typeof vi.fn>;
  };
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    blockedUserIds = signal<ReadonlySet<string>>(new Set());
    currentUser = vi.fn().mockReturnValue({ id: 'viewer-id' });
    confirm = vi.fn().mockResolvedValue(false);
    // The Async variants mirror the real service: the shared block cache only
    // changes once the request has succeeded.
    safety = {
      blockUserAsync: vi.fn(async (id: string) => {
        blockedUserIds.update((ids) => new Set([...ids, id]));
        return { success: true, blocked_id: id, already_blocked: false };
      }),
      unblockUserAsync: vi.fn(async (id: string) => {
        blockedUserIds.update((ids) => new Set([...ids].filter((blocked) => blocked !== id)));
        return { success: true };
      }),
      reportUser: vi.fn().mockResolvedValue({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: false,
      }),
    };

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
          useValue: { addFavourite: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SafetyService,
          useValue: { blockedUserIdsSignal: blockedUserIds.asReadonly(), ...safety },
        },
        {
          provide: ConfirmService,
          useValue: { confirm },
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

  describe('block and report actions', () => {
    const toastMessages = (): string[] =>
      toastsSignal().map((toast) => `${toast.type}:${toast.message}`);

    beforeEach(() => {
      toastsSignal.set([]);
    });

    it('asks for confirmation and changes nothing when blocking is declined', async () => {
      await fixture.componentInstance.onBlockToggle({ senderId: 'sender-id', blocked: true });
      fixture.detectChanges();

      expect(confirm).toHaveBeenCalledWith('chat.blockConfirm');
      expect(safety.blockUserAsync).not.toHaveBeenCalled();
      expect(fixture.componentInstance.isBlocked()).toBe(false);
      expect(toastMessages()).toEqual([]);
    });

    it('blocks the sender once confirmed, hides the message and announces the result', async () => {
      confirm.mockResolvedValue(true);
      const hidden: string[] = [];
      fixture.componentInstance.messageBlocked.subscribe((id) => hidden.push(id));

      await fixture.componentInstance.onBlockToggle({ senderId: 'sender-id', blocked: true });
      fixture.detectChanges();

      expect(safety.blockUserAsync).toHaveBeenCalledWith('sender-id');
      expect(fixture.componentInstance.isBlocked()).toBe(true);
      expect(hidden).toEqual(['sender-id']);
      expect(toastMessages()).toContain('success:chat.blockSuccess');
    });

    it('leaves the thread unchanged and reports an error when blocking fails', async () => {
      confirm.mockResolvedValue(true);
      safety.blockUserAsync.mockRejectedValueOnce(new Error('service unavailable'));

      await fixture.componentInstance.onBlockToggle({ senderId: 'sender-id', blocked: true });
      fixture.detectChanges();

      expect(fixture.componentInstance.isBlocked()).toBe(false);
      expect(toastMessages()).toEqual(['error:chat.blockError']);
    });

    it('unblocks without a confirmation prompt and restores the message', async () => {
      blockedUserIds.set(new Set(['sender-id']));
      fixture.detectChanges();
      expect(fixture.componentInstance.isBlocked()).toBe(true);

      await fixture.componentInstance.onBlockToggle({ senderId: 'sender-id', blocked: false });
      fixture.detectChanges();

      expect(confirm).not.toHaveBeenCalled();
      expect(safety.unblockUserAsync).toHaveBeenCalledWith('sender-id');
      expect(fixture.componentInstance.isBlocked()).toBe(false);
      expect(toastMessages()).toContain('success:chat.unblockSuccess');
    });

    it('keeps the block in place and reports an error when unblocking fails', async () => {
      blockedUserIds.set(new Set(['sender-id']));
      fixture.detectChanges();
      safety.unblockUserAsync.mockRejectedValueOnce(new Error('service unavailable'));

      await fixture.componentInstance.onBlockToggle({ senderId: 'sender-id', blocked: false });
      fixture.detectChanges();

      expect(fixture.componentInstance.isBlocked()).toBe(true);
      expect(toastMessages()).toEqual(['error:chat.blockError']);
    });

    it('does not report the sender unless the reporter confirms', async () => {
      await fixture.componentInstance.onReport({ messageId: 'message-id', senderId: 'sender-id' });

      expect(confirm).toHaveBeenCalledWith('report.confirmMessage');
      expect(safety.reportUser).not.toHaveBeenCalled();
      expect(toastMessages()).toEqual([]);
    });

    it('reports the sender with a translated description and the page context', async () => {
      confirm.mockResolvedValue(true);

      await fixture.componentInstance.onReport({ messageId: 'message-id', senderId: 'sender-id' });

      expect(safety.reportUser).toHaveBeenCalledWith({
        reported_id: 'sender-id',
        reason_category: 'other',
        description: 'report.chat_description',
        context_url: window.location.href,
      });
      expect(toastMessages()).toEqual(['success:report.toast_success']);
    });

    it('tells the reporter when an open report already exists', async () => {
      confirm.mockResolvedValue(true);
      safety.reportUser.mockResolvedValueOnce({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: true,
      });

      await fixture.componentInstance.onReport({ messageId: 'message-id', senderId: 'sender-id' });

      expect(toastMessages()).toEqual(['success:report.toast_duplicate']);
    });

    it('shows an error instead of a false success when the report fails', async () => {
      confirm.mockResolvedValue(true);
      safety.reportUser.mockRejectedValueOnce(new Error('service unavailable'));

      await fixture.componentInstance.onReport({ messageId: 'message-id', senderId: 'sender-id' });

      expect(toastMessages()).toEqual(['error:report.toast_error']);
    });
  });
});
