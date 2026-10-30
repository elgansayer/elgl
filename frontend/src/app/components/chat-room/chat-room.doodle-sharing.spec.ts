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
import { toastsSignal } from '../../services/toast.service';
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
  let i18n: I18nService;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function doodleTrigger(): HTMLButtonElement {
    const trigger = fixture.nativeElement.querySelector(
      `button[aria-label="${i18n.translate('chatRoom.doodleBtn')}"]`,
    ) as HTMLButtonElement | null;
    expect(trigger).toBeTruthy();
    return trigger as HTMLButtonElement;
  }

  function doodleDialog(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('[role="dialog"]');
  }

  async function openFromTrigger(): Promise<HTMLButtonElement> {
    const trigger = doodleTrigger();
    trigger.focus();
    trigger.click();
    await settle();
    expect(component.showDoodleModal()).toBe(true);
    return trigger;
  }

  beforeEach(async () => {
    sendMessage = vi.fn();
    toastsSignal.set([]);
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
      listen: vi.fn().mockReturnValue(() => undefined),
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

    i18n = TestBed.inject(I18nService);
    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'room-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    toastsSignal.set([]);
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

  describe('modal host', () => {
    it('uses a labelled modal Spartan dialog with focus containment', async () => {
      const trigger = await openFromTrigger();

      const dialog = doodleDialog();
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.getAttribute('aria-labelledby')).toBe('doodle-pad-title');
      expect(document.getElementById('doodle-pad-title')?.textContent?.trim()).toBe(
        i18n.translate('doodle.title'),
      );
      expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
      expect(dialog?.querySelector('app-doodle-pad canvas')).not.toBeNull();
      expect(document.body.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
      expect(dialog?.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(trigger);
      expect(fixture.nativeElement.querySelector('app-doodle-pad')).toBeNull();
    });

    it('closes on Escape without sending and returns focus to the Doodle trigger', async () => {
      const trigger = await openFromTrigger();

      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await settle();

      expect(component.showDoodleModal()).toBe(false);
      expect(doodleDialog()).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('closes on backdrop activation without emitting a doodle cancellation or send', async () => {
      await openFromTrigger();
      const cancelled = vi.spyOn(
        fixture.debugElement.query(By.directive(DoodlePadComponent)).componentInstance.cancelled,
        'emit',
      );

      document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
      await settle();

      expect(component.showDoodleModal()).toBe(false);
      expect(doodleDialog()).toBeNull();
      expect(cancelled).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('keeps all editor actions reachable in short and zoomed viewports', async () => {
      await openFromTrigger();

      const panel = document.body.querySelector('hlm-dialog-content');
      expect(panel?.classList.contains('max-h-[calc(100dvh-2rem)]')).toBe(true);
      expect(panel?.classList.contains('overflow-y-auto')).toBe(true);
      expect(panel?.classList.contains('overscroll-contain')).toBe(true);
      expect(panel?.classList.contains('max-w-[calc(100%-2rem)]')).toBe(true);
      expect(panel?.classList.contains('sm:max-w-[min(42rem,calc(100%-2rem))]')).toBe(true);
      expect(document.body.querySelector('[data-slot="dialog-close"]')).toBeNull();
    });
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

  it('closes the dialog when the pad emits a saved doodle and sends it exactly once', async () => {
    const dataUrl = 'data:image/png;base64,c2F2ZWQ=';
    sendMessage.mockResolvedValue(doodleMessage(dataUrl));
    await openFromTrigger();

    fixture.debugElement
      .query(By.directive(DoodlePadComponent))
      .componentInstance.doodleSaved.emit(dataUrl);
    await settle();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(component.showDoodleModal()).toBe(false);
    expect(doodleDialog()).toBeNull();
  });

  it('stores a translated caption rather than the raw translation key', async () => {
    sendMessage.mockResolvedValue(doodleMessage('data:image/png;base64,Y2FwdGlvbg=='));

    await component.onDoodleSaved('data:image/png;base64,Y2FwdGlvbg==');

    const [payload] = sendMessage.mock.calls[0];
    expect(payload.text_content).toBe(i18n.translate('chatRoom.doodleCaption'));
    expect(payload.text_content).toBe('Doodle');
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

  it('tells the sender when the doodle could not be sent without leaking its content', async () => {
    const dataUrl = 'data:image/png;base64,c2VjcmV0LWRvb2RsZQ==';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendMessage.mockRejectedValueOnce(new Error('network down'));

    await component.onDoodleSaved(dataUrl);

    const toast = toastsSignal().at(-1);
    expect(toast?.type).toBe('error');
    expect(toast?.message).toBe(i18n.translate('chatRoom.doodleSendFailed'));
    expect(toast?.message).not.toContain(dataUrl);
  });

  it('renders persisted doodle messages as images in the chat timeline', () => {
    const dataUrl = 'data:image/png;base64,dGVzdC1yZW5kZXI=';
    component.isLoading.set(false);
    component.messages.set([doodleMessage(dataUrl)]);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      `img[src="${dataUrl}"]`,
    ) as HTMLImageElement | null;
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toBe(dataUrl);
    expect(image?.getAttribute('alt')).toBe(i18n.translate('chatRoom.doodleImageAlt'));
  });
});
