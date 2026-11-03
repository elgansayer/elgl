import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatMediaMessageService } from '../../services/chat-media-message.service';
import { ChatMediaService, UploadedChatMedia } from '../../services/chat-media.service';
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

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const REDRAWN_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAAC';

const uploadedDoodle: UploadedChatMedia = {
  url: 'https://cdn.example/chat-media/user-1/doodle/standard/1-a.png',
  objectKey: 'chat-media/user-1/doodle/standard/1-a.png',
  kind: 'doodle',
  quality: 'standard',
};

function doodleMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'doodle-message-1',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'doodle',
    media_url: uploadedDoodle.url,
    is_read: true,
    created_at: '2026-08-22T12:00:00.000Z',
    sender: { id: 'user-1', display_name: 'Me', avatar_url: null },
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ChatRoomComponent doodle sharing contract', () => {
  let fixture: ComponentFixture<ChatRoomComponent>;
  let component: ChatRoomComponent;
  let sendMessage: ReturnType<typeof vi.fn>;
  let uploadDoodle: ReturnType<typeof vi.fn>;
  let sendUploadedMedia: ReturnType<typeof vi.fn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    sendMessage = vi.fn();
    uploadDoodle = vi.fn();
    sendUploadedMedia = vi.fn();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    toastsSignal.set([]);

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
        { provide: ChatMediaService, useValue: { uploadDoodle } },
        { provide: ChatMediaMessageService, useValue: { send: sendUploadedMedia } },
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
    toastsSignal.set([]);
    vi.restoreAllMocks();
  });

  function pad(): DoodlePadComponent | null {
    return fixture.debugElement.query(By.directive(DoodlePadComponent))?.componentInstance ?? null;
  }

  function openPad(): void {
    component.openDoodlePad();
    fixture.detectChanges();
  }

  describe('dialog', () => {
    it('opens from the composer Doodle button as a labelled modal dialog', () => {
      const button = fixture.nativeElement.querySelector(
        'button[aria-label="Doodle"]',
      ) as HTMLButtonElement;
      button.click();
      fixture.detectChanges();

      const dialog = document.body.querySelector('[role="dialog"][aria-modal="true"]');
      expect(component.showDoodleModal()).toBe(true);
      expect(dialog).toBeTruthy();
      if (!dialog) throw new Error('Expected the doodle dialog to be rendered');
      const labelledBy = dialog.getAttribute('aria-labelledby') ?? '';
      expect(document.getElementById(labelledBy)?.textContent).toContain('Interactive Doodle Pad');
    });

    it('never references an element that does not exist from inside the dialog', () => {
      openPad();

      const dialog = document.body.querySelector('[role="dialog"]');
      if (!dialog) throw new Error('Expected the doodle dialog to be rendered');
      const referenced = [dialog, ...Array.from(dialog.querySelectorAll('*'))].flatMap((element) =>
        ['aria-labelledby', 'aria-describedby', 'aria-controls'].flatMap((attribute) =>
          (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean),
        ),
      );

      expect(referenced.length).toBeGreaterThan(0);
      expect(referenced.filter((id) => document.getElementById(id) === null)).toEqual([]);
    });

    it('describes what the dialog is for to assistive technology', () => {
      openPad();

      const dialog = document.body.querySelector('[role="dialog"]');
      const describedBy = dialog?.getAttribute('aria-describedby') ?? '';

      expect(document.getElementById(describedBy)?.textContent).toContain('Draw with your pointer');
    });

    it('has exactly one heading naming the dialog', () => {
      openPad();

      const dialog = document.body.querySelector('[role="dialog"]');
      const labelledBy = dialog?.getAttribute('aria-labelledby') ?? '';
      const heading = document.getElementById(labelledBy);

      expect(heading?.tagName).toBe('H2');
      expect(heading?.textContent).toContain('Interactive Doodle Pad');
      expect(dialog?.querySelectorAll('[id^="brn-dialog-title-"]')).toHaveLength(1);
    });

    it('closes from the pad cancel output without sending anything', async () => {
      openPad();

      pad()?.cancelled.emit();
      fixture.detectChanges();

      expect(component.showDoodleModal()).toBe(false);
      await vi.waitFor(() => expect(pad()).toBeNull());
      expect(uploadDoodle).not.toHaveBeenCalled();
      expect(sendUploadedMedia).not.toHaveBeenCalled();
    });

    it('closes on Escape', async () => {
      openPad();

      document.body
        .querySelector('[role="dialog"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      await vi.waitFor(() => expect(component.showDoodleModal()).toBe(false));
    });

    it('starts every opening with a clean slate', async () => {
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockRejectedValue(new Error('offline'));
      openPad();
      await component.onDoodleSaved(DATA_URL);
      expect(component.doodleErrorKey()).toBe('doodle.sendFailed');

      component.closeDoodlePad();
      openPad();

      expect(component.doodleErrorKey()).toBeNull();
      expect(pad()?.errorKey()).toBeNull();
    });
  });

  describe('sending', () => {
    it('uploads the PNG once, sends it as an owned doodle object and appends the message once', async () => {
      const sent = doodleMessage();
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockResolvedValue(sent);
      openPad();

      await component.onDoodleSaved(DATA_URL);

      expect(uploadDoodle).toHaveBeenCalledTimes(1);
      expect(uploadDoodle).toHaveBeenCalledWith(DATA_URL);
      expect(sendUploadedMedia).toHaveBeenCalledWith('room-1', uploadedDoodle);
      expect(component.messages()).toEqual([sent]);
      expect(component.showDoodleModal()).toBe(false);
      expect(component.isSendingDoodle()).toBe(false);
      expect(component.doodleErrorKey()).toBeNull();
    });

    it('never sends the PNG inline through the generic message endpoint', async () => {
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockResolvedValue(doodleMessage());
      openPad();

      await component.onDoodleSaved(DATA_URL);

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('does not duplicate a message the realtime channel already delivered', async () => {
      const sent = doodleMessage();
      component.messages.set([sent]);
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockResolvedValue(sent);
      openPad();

      await component.onDoodleSaved(DATA_URL);

      expect(component.messages()).toEqual([sent]);
    });

    it('ignores a second save while the first is still in flight', async () => {
      const upload = deferred<UploadedChatMedia>();
      uploadDoodle.mockReturnValue(upload.promise);
      sendUploadedMedia.mockResolvedValue(doodleMessage());
      openPad();

      const first = component.onDoodleSaved(DATA_URL);
      expect(component.isSendingDoodle()).toBe(true);
      await component.onDoodleSaved(DATA_URL);
      upload.resolve(uploadedDoodle);
      await first;

      expect(uploadDoodle).toHaveBeenCalledTimes(1);
      expect(sendUploadedMedia).toHaveBeenCalledTimes(1);
      expect(component.messages()).toHaveLength(1);
    });

    it('tells the pad it is busy while sending so the drawing cannot change underneath it', async () => {
      const upload = deferred<UploadedChatMedia>();
      uploadDoodle.mockReturnValue(upload.promise);
      sendUploadedMedia.mockResolvedValue(doodleMessage());
      openPad();
      expect(pad()?.busy()).toBe(false);

      const saving = component.onDoodleSaved(DATA_URL);
      fixture.detectChanges();
      expect(pad()?.busy()).toBe(true);
      expect(document.body.querySelector('[role="status"]')?.textContent).toContain(
        'Sending doodle',
      );

      upload.resolve(uploadedDoodle);
      await saving;
      fixture.detectChanges();
      await vi.waitFor(() => expect(pad()).toBeNull());
    });
  });

  describe('failure and retry', () => {
    it('keeps the drawing open with an announced error when the send fails', async () => {
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockRejectedValue(new Error('network down'));
      openPad();

      await expect(component.onDoodleSaved(DATA_URL)).resolves.toBeUndefined();
      fixture.detectChanges();

      expect(component.showDoodleModal()).toBe(true);
      expect(component.messages()).toEqual([]);
      expect(component.isSendingDoodle()).toBe(false);
      expect(component.doodleErrorKey()).toBe('doodle.sendFailed');
      const alert = document.body.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.textContent).toContain('Your doodle could not be sent');
      expect(consoleError).toHaveBeenCalledWith('Failed to send doodle:', 'network down');
    });

    it('logs only a status for an HTTP failure so a signed upload URL never reaches the console', async () => {
      uploadDoodle.mockRejectedValue(
        new HttpErrorResponse({
          status: 403,
          url: 'https://upload.example/object?signature=secret-token',
        }),
      );
      openPad();

      await component.onDoodleSaved(DATA_URL);

      expect(consoleError).toHaveBeenCalledWith('Failed to send doodle:', 'HTTP 403');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-token');
      expect(component.doodleErrorKey()).toBe('doodle.sendFailed');
    });

    it('retries a failed send against the stored object without uploading the PNG again', async () => {
      const sent = doodleMessage();
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockRejectedValueOnce(new Error('network down')).mockResolvedValue(sent);
      openPad();

      await component.onDoodleSaved(DATA_URL);
      await component.onDoodleSaved(DATA_URL);

      expect(uploadDoodle).toHaveBeenCalledTimes(1);
      expect(sendUploadedMedia).toHaveBeenCalledTimes(2);
      expect(sendUploadedMedia).toHaveBeenNthCalledWith(2, 'room-1', uploadedDoodle);
      expect(component.messages()).toEqual([sent]);
      expect(component.showDoodleModal()).toBe(false);
      expect(component.doodleErrorKey()).toBeNull();
    });

    it('clears the previous error as soon as a new attempt starts', async () => {
      const upload = deferred<UploadedChatMedia>();
      uploadDoodle
        .mockRejectedValueOnce(new Error('upload failed'))
        .mockReturnValue(upload.promise);
      openPad();
      await component.onDoodleSaved(DATA_URL);
      expect(component.doodleErrorKey()).toBe('doodle.sendFailed');

      const retry = component.onDoodleSaved(DATA_URL);

      expect(component.doodleErrorKey()).toBeNull();
      upload.reject(new Error('still offline'));
      await retry;
    });

    it('uploads again after an upload failure because no object was stored', async () => {
      uploadDoodle
        .mockRejectedValueOnce(new Error('upload failed'))
        .mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockResolvedValue(doodleMessage());
      openPad();

      await component.onDoodleSaved(DATA_URL);
      expect(sendUploadedMedia).not.toHaveBeenCalled();
      expect(component.doodleErrorKey()).toBe('doodle.sendFailed');

      await component.onDoodleSaved(DATA_URL);

      expect(uploadDoodle).toHaveBeenCalledTimes(2);
      expect(sendUploadedMedia).toHaveBeenCalledTimes(1);
      expect(component.messages()).toHaveLength(1);
    });

    it('uploads a new object when the drawing changed after a failed send', async () => {
      const redrawn: UploadedChatMedia = {
        ...uploadedDoodle,
        objectKey: 'chat-media/user-1/doodle/standard/2-b.png',
      };
      uploadDoodle.mockResolvedValueOnce(uploadedDoodle).mockResolvedValueOnce(redrawn);
      sendUploadedMedia
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue(doodleMessage());
      openPad();

      await component.onDoodleSaved(DATA_URL);
      await component.onDoodleSaved(REDRAWN_DATA_URL);

      expect(uploadDoodle).toHaveBeenNthCalledWith(2, REDRAWN_DATA_URL);
      expect(sendUploadedMedia).toHaveBeenNthCalledWith(2, 'room-1', redrawn);
    });

    it('does not reuse a stored object after the pad was closed and reopened', async () => {
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue(doodleMessage());
      openPad();
      await component.onDoodleSaved(DATA_URL);

      component.closeDoodlePad();
      openPad();
      await component.onDoodleSaved(DATA_URL);

      expect(uploadDoodle).toHaveBeenCalledTimes(2);
    });

    it('reports a failure by toast when the pad was dismissed while the send was in flight', async () => {
      const send = deferred<ChatMessage>();
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockReturnValue(send.promise);
      openPad();

      const saving = component.onDoodleSaved(DATA_URL);
      await vi.waitFor(() => expect(sendUploadedMedia).toHaveBeenCalled());
      component.closeDoodlePad();
      send.reject(new Error('network down'));
      await saving;

      expect(component.doodleErrorKey()).toBeNull();
      expect(toastsSignal().map((toast) => [toast.type, toast.message])).toEqual([
        ['error', 'Your doodle could not be sent.'],
      ]);
    });
  });

  describe('dismissing and reopening the pad mid-send', () => {
    async function dismissAndReopenWhileSending(): Promise<{
      saving: Promise<void>;
      send: ReturnType<typeof deferred<ChatMessage>>;
    }> {
      const send = deferred<ChatMessage>();
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockReturnValue(send.promise);
      openPad();

      const saving = component.onDoodleSaved(DATA_URL);
      await vi.waitFor(() => expect(sendUploadedMedia).toHaveBeenCalled());
      component.closeDoodlePad();
      openPad();
      return { saving, send };
    }

    it('keeps the newer pad frozen, not closed, until the earlier send finishes', async () => {
      const { saving, send } = await dismissAndReopenWhileSending();
      fixture.detectChanges();
      expect(pad()?.busy()).toBe(true);

      send.resolve(doodleMessage());
      await saving;
      fixture.detectChanges();

      expect(component.messages()).toEqual([doodleMessage()]);
      expect(component.showDoodleModal()).toBe(true);
      expect(component.isSendingDoodle()).toBe(false);
      expect(pad()?.busy()).toBe(false);
    });

    it('reports the earlier failure by toast and leaves the newer pad clean', async () => {
      const { saving, send } = await dismissAndReopenWhileSending();

      send.reject(new Error('network down'));
      await saving;

      expect(component.showDoodleModal()).toBe(true);
      expect(component.doodleErrorKey()).toBeNull();
      expect(toastsSignal().map((toast) => toast.type)).toEqual(['error']);
    });
  });

  describe('dismissing the pad mid-upload', () => {
    it('cancels the send: no message is created from an upload the learner abandoned', async () => {
      const upload = deferred<UploadedChatMedia>();
      uploadDoodle.mockReturnValue(upload.promise);
      openPad();

      const saving = component.onDoodleSaved(DATA_URL);
      component.closeDoodlePad();
      upload.resolve(uploadedDoodle);
      await saving;

      expect(sendUploadedMedia).not.toHaveBeenCalled();
      expect(component.messages()).toEqual([]);
      expect(component.isSendingDoodle()).toBe(false);
      expect(toastsSignal()).toEqual([]);
    });

    it('never lets the abandoned upload be sent from a pad opened afterwards', async () => {
      const upload = deferred<UploadedChatMedia>();
      uploadDoodle.mockReturnValueOnce(upload.promise).mockResolvedValue(uploadedDoodle);
      openPad();
      const abandoned = component.onDoodleSaved(DATA_URL);
      component.closeDoodlePad();
      openPad();

      upload.resolve(uploadedDoodle);
      await abandoned;
      sendUploadedMedia.mockResolvedValue(doodleMessage());
      await component.onDoodleSaved(DATA_URL);

      expect(uploadDoodle).toHaveBeenCalledTimes(2);
      expect(sendUploadedMedia).toHaveBeenCalledTimes(1);
      expect(component.messages()).toHaveLength(1);
    });
  });

  describe('moving between rooms', () => {
    it('never appends a late doodle to the room the learner moved to', async () => {
      const send = deferred<ChatMessage>();
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockReturnValue(send.promise);
      openPad();

      const saving = component.onDoodleSaved(DATA_URL);
      await vi.waitFor(() => expect(sendUploadedMedia).toHaveBeenCalled());
      fixture.componentRef.setInput('id', 'room-2');
      fixture.detectChanges();
      await fixture.whenStable();
      send.resolve(doodleMessage({ room_id: 'room-1' }));
      await saving;

      expect(sendUploadedMedia).toHaveBeenCalledWith('room-1', uploadedDoodle);
      expect(component.messages()).toEqual([]);
      expect(component.showDoodleModal()).toBe(false);
    });

    it('closes an open pad and drops its stored object when the room changes', async () => {
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockRejectedValue(new Error('network down'));
      openPad();
      await component.onDoodleSaved(DATA_URL);
      expect(component.doodleErrorKey()).toBe('doodle.sendFailed');

      fixture.componentRef.setInput('id', 'room-2');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.showDoodleModal()).toBe(false);
      expect(component.doodleErrorKey()).toBeNull();

      sendUploadedMedia.mockResolvedValue(doodleMessage({ room_id: 'room-2' }));
      openPad();
      await component.onDoodleSaved(DATA_URL);

      expect(uploadDoodle).toHaveBeenCalledTimes(2);
      expect(sendUploadedMedia).toHaveBeenLastCalledWith('room-2', uploadedDoodle);
    });

    it('reports a failure by toast, not in the new room, when the learner already left', async () => {
      const send = deferred<ChatMessage>();
      uploadDoodle.mockResolvedValue(uploadedDoodle);
      sendUploadedMedia.mockReturnValue(send.promise);
      openPad();

      const saving = component.onDoodleSaved(DATA_URL);
      await vi.waitFor(() => expect(sendUploadedMedia).toHaveBeenCalled());
      fixture.componentRef.setInput('id', 'room-2');
      fixture.detectChanges();
      await fixture.whenStable();
      send.reject(new Error('network down'));
      await saving;

      expect(component.doodleErrorKey()).toBeNull();
      expect(toastsSignal()).toHaveLength(1);
    });
  });

  describe('rendering', () => {
    it('renders persisted doodle messages as images with a sender-aware text alternative', () => {
      component.isLoading.set(false);
      component.messages.set([doodleMessage()]);
      fixture.detectChanges();

      const image = fixture.nativeElement.querySelector(
        `img[src="${uploadedDoodle.url}"]`,
      ) as HTMLImageElement | null;
      expect(image).toBeTruthy();
      expect(image?.getAttribute('alt')).toBe('Doodle from Me');
    });

    it('still renders legacy inline PNG doodles stored before the media pipeline', () => {
      component.isLoading.set(false);
      component.messages.set([doodleMessage({ media_url: DATA_URL })]);
      fixture.detectChanges();

      const image = fixture.nativeElement.querySelector('img[alt="Doodle from Me"]');
      expect(image?.getAttribute('src')).toBe(DATA_URL);
    });

    it('falls back to a translated unknown-user label rather than an empty alternative', () => {
      component.isLoading.set(false);
      component.messages.set([doodleMessage({ sender: undefined })]);
      fixture.detectChanges();

      const image = fixture.nativeElement.querySelector(`img[src="${uploadedDoodle.url}"]`);
      expect(image?.getAttribute('alt')).toBe('Doodle from Unknown user');
    });
  });
});
