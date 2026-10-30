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

  function pressEscape(): void {
    const target = document.activeElement ?? document.body;
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  }

  function cancelButtons(): HTMLButtonElement[] {
    const label = i18n.translate('doodle.cancelBtn');
    return Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        `[role="dialog"] button[aria-label="${label}"]`,
      ),
    );
  }

  async function openFromTrigger(): Promise<HTMLButtonElement> {
    const trigger = doodleTrigger();
    trigger.focus();
    trigger.click();
    await settle();
    expect(component.showDoodleModal()).toBe(true);
    return trigger;
  }

  /** Counts how many times the host is asked to close the pad, so duplicate dismissals are caught. */
  function watchCloseRequests(): () => number {
    const setSpy = vi.spyOn(component.showDoodleModal, 'set');
    return () => setSpy.mock.calls.filter(([visible]) => visible === false).length;
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

  it('opens and cancels the owned doodle pad from the chat-room modal contract', async () => {
    component.showDoodleModal.set(true);
    await settle();

    const doodlePad = fixture.debugElement.query(By.directive(DoodlePadComponent));
    expect(doodlePad).toBeTruthy();

    (doodlePad.componentInstance as DoodlePadComponent).cancelled.emit();
    await settle();

    expect(component.showDoodleModal()).toBe(false);
    expect(fixture.debugElement.query(By.directive(DoodlePadComponent))).toBeNull();
    expect(doodleDialog()).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  describe('modal host', () => {
    it('is hosted by a modal Spartan dialog named by the translated pad title', async () => {
      await openFromTrigger();

      const dialog = doodleDialog();
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');

      const labelledBy = dialog?.getAttribute('aria-labelledby');
      expect(labelledBy).toBe('doodle-pad-title');
      expect(document.getElementById(labelledBy ?? '')?.textContent?.trim()).toBe(
        i18n.translate('doodle.title'),
      );

      // The only available description repeats the title, and the Spartan default would otherwise
      // reference an element that does not exist, so the dialog deliberately has no description.
      expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
      expect(dialog?.querySelector('app-doodle-pad canvas')).not.toBeNull();
    });

    it('never references an accessible name or description element that is missing', async () => {
      await openFromTrigger();

      const dialog = doodleDialog();
      for (const attribute of ['aria-labelledby', 'aria-describedby']) {
        const ids = dialog?.getAttribute(attribute)?.split(/\s+/).filter(Boolean) ?? [];
        for (const id of ids) {
          expect(document.getElementById(id), `${attribute}="${id}"`).not.toBeNull();
        }
      }
    });

    it('traps Tab and Shift+Tab inside the dialog with the CDK focus-trap anchors', async () => {
      await openFromTrigger();

      const anchors = document.body.querySelectorAll('.cdk-focus-trap-anchor');
      expect(anchors).toHaveLength(2);
      expect(anchors[0].nextElementSibling).toBe(doodleDialog());
      expect(anchors[1].previousElementSibling).toBe(doodleDialog());
    });

    it('no longer renders a hand-built fixed backdrop around the pad', async () => {
      await openFromTrigger();

      const pad = document.body.querySelector('app-doodle-pad');
      expect(pad).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-doodle-pad')).toBeNull();
      expect(pad?.closest('.bg-black\\/60')).toBeNull();
      expect(pad?.closest('[role="dialog"]')).toBe(doodleDialog());
    });

    it('moves focus into the dialog when it opens', async () => {
      const trigger = await openFromTrigger();

      expect(doodleDialog()?.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(trigger);
    });

    it('closes exactly once on Escape and returns focus to the Doodle trigger', async () => {
      const trigger = await openFromTrigger();
      const closeRequests = watchCloseRequests();

      pressEscape();
      await settle();

      expect(closeRequests()).toBe(1);
      expect(component.showDoodleModal()).toBe(false);
      expect(doodleDialog()).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('closes exactly once when the backdrop is activated', async () => {
      await openFromTrigger();
      const closeRequests = watchCloseRequests();
      const cancelled = vi.spyOn(
        fixture.debugElement.query(By.directive(DoodlePadComponent)).componentInstance.cancelled,
        'emit',
      );

      document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
      await settle();

      expect(closeRequests()).toBe(1);
      expect(component.showDoodleModal()).toBe(false);
      expect(doodleDialog()).toBeNull();
      expect(document.body.querySelector('.cdk-overlay-backdrop')).toBeNull();
      expect(cancelled).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('closes exactly once from the header close control and returns focus to the trigger', async () => {
      const trigger = await openFromTrigger();
      const closeRequests = watchCloseRequests();
      const [headerClose] = cancelButtons();
      expect(headerClose).toBeTruthy();

      headerClose.click();
      await settle();

      expect(closeRequests()).toBe(1);
      expect(component.showDoodleModal()).toBe(false);
      expect(doodleDialog()).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('closes exactly once from the footer Cancel action without sending anything', async () => {
      const trigger = await openFromTrigger();
      const closeRequests = watchCloseRequests();
      const buttons = cancelButtons();
      expect(buttons).toHaveLength(2);

      buttons[1].click();
      await settle();

      expect(closeRequests()).toBe(1);
      expect(component.showDoodleModal()).toBe(false);
      expect(doodleDialog()).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('can be reopened after being dismissed', async () => {
      await openFromTrigger();
      pressEscape();
      await settle();
      expect(doodleDialog()).toBeNull();

      await openFromTrigger();

      expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      expect(document.body.querySelectorAll('app-doodle-pad')).toHaveLength(1);
    });

    it('keeps the panel scrollable within short and zoomed viewports', async () => {
      await openFromTrigger();

      const panel = document.body.querySelector('hlm-dialog-content');
      expect(panel).not.toBeNull();
      expect(panel?.classList.contains('max-h-[calc(100dvh-2rem)]')).toBe(true);
      expect(panel?.classList.contains('overflow-y-auto')).toBe(true);
      expect(panel?.classList.contains('overscroll-contain')).toBe(true);
      // The card supplies the visible surface, so the scrolling panel stays transparent.
      expect(panel?.classList.contains('bg-transparent')).toBe(true);
      expect(panel?.classList.contains('p-0')).toBe(true);
      expect(panel?.classList.contains('bg-popover')).toBe(false);
      expect(panel?.classList.contains('p-4')).toBe(false);
      expect(panel?.classList.contains('ring-0')).toBe(true);
      expect(panel?.classList.contains('ring-1')).toBe(false);
    });

    it('keeps a side gutter on narrow screens and widens to the card size from the sm breakpoint', async () => {
      await openFromTrigger();

      const panel = document.body.querySelector('hlm-dialog-content');
      expect(panel?.classList.contains('max-w-[calc(100%-2rem)]')).toBe(true);
      expect(panel?.classList.contains('sm:max-w-[min(42rem,calc(100%-2rem))]')).toBe(true);
      expect(panel?.classList.contains('sm:max-w-sm')).toBe(false);
    });

    it('does not render the generic close icon that would duplicate the pad close control', async () => {
      await openFromTrigger();

      expect(document.body.querySelector('[data-slot="dialog-close"]')).toBeNull();
    });

    it('removes the overlay when the chat room is destroyed while the pad is open', async () => {
      await openFromTrigger();
      expect(doodleDialog()).not.toBeNull();

      fixture.destroy();

      expect(doodleDialog()).toBeNull();
      expect(document.body.querySelector('.cdk-overlay-backdrop')).toBeNull();
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
    expect(payload.text_content).not.toBe('chatRoom.doodleCaption');
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
    expect(toast?.message).not.toBe('chatRoom.doodleSendFailed');
    expect(toast?.message).not.toContain(dataUrl);
  });

  it('does not raise a failure notice when the doodle is sent successfully', async () => {
    sendMessage.mockResolvedValue(doodleMessage('data:image/png;base64,b2s='));

    await component.onDoodleSaved('data:image/png;base64,b2s=');

    expect(toastsSignal()).toEqual([]);
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
  });

  it('gives timeline doodles a translated accessible name instead of hard-coded English', () => {
    const dataUrl = 'data:image/png;base64,YWx0LXRleHQ=';
    component.isLoading.set(false);
    component.messages.set([doodleMessage(dataUrl)]);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      `img[src="${dataUrl}"]`,
    ) as HTMLImageElement | null;
    expect(image?.getAttribute('alt')).toBe(i18n.translate('chatRoom.doodleImageAlt'));
    expect(image?.getAttribute('alt')).not.toBe('doodle');
    expect(image?.getAttribute('alt')).not.toBe('chatRoom.doodleImageAlt');
  });
});
