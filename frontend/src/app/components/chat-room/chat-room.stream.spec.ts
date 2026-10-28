import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import {
  CHAT_HISTORY_PAGE_SIZE,
  ChatMessage,
  ChatRoom,
  ChatService,
  GroupMember,
} from '../../services/chat.service';
import { DraftService } from '../../services/draft.service';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { TypingService } from '../../services/typing.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import type { TypingUser } from '../primitives/typing-indicator/typing-indicator.component';
import { ChatRoomComponent } from './chat-room.component';

type ConnectionStatus =
  'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'rate-limited' | 'error';

const ROOM_ID = 'room-1';
const ME = 'user-1';
const PARTNER = 'user-2';

function minutesAfterStart(minute: number): string {
  return new Date(Date.UTC(2026, 7, 21, 12, 0, 0) + minute * 60_000).toISOString();
}

function message(id: string, minute: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    room_id: ROOM_ID,
    sender_id: PARTNER,
    message_type: 'text',
    text_content: `text of ${id}`,
    is_read: false,
    delivery_status: 'delivered',
    created_at: minutesAfterStart(minute),
    sender: { id: PARTNER, display_name: 'Emma', avatar_url: null },
    ...overrides,
  };
}

function ownMessage(id: string, minute: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return message(id, minute, {
    sender_id: ME,
    sender: { id: ME, display_name: 'Me', avatar_url: null },
    ...overrides,
  });
}

function fullPage(): ChatMessage[] {
  return Array.from({ length: CHAT_HISTORY_PAGE_SIZE }, (_, index) =>
    message(`page-${index}`, 100 + index),
  );
}

function room(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: ROOM_ID,
    title: 'Spanish practice',
    subtitle: '',
    avatar: '',
    is_online: true,
    is_pinned: false,
    created_at: minutesAfterStart(0),
    ...overrides,
  };
}

interface ListMetrics {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

interface Harness {
  fixture: ComponentFixture<ChatRoomComponent>;
  component: ChatRoomComponent;
  chat: {
    getRooms: ReturnType<typeof vi.fn>;
    getGroupMembers: ReturnType<typeof vi.fn>;
    getLatestMessages: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    markRoomRead: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    getMessageReceipts: ReturnType<typeof vi.fn>;
  };
  centrifuge: {
    connectionStatus: ReturnType<typeof signal<ConnectionStatus>>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  typing: {
    typingUsers: ReturnType<typeof signal<TypingUser[]>>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    sendTyping: ReturnType<typeof vi.fn>;
  };
  i18n: I18nService;
  /** Delivers a publication to the room channel exactly as Centrifugo would. */
  publish(payload: unknown): void;
  settle(): Promise<void>;
  root(): HTMLElement;
  list(): HTMLElement;
  /** Gives the jsdom list element real scroll geometry and returns the mutable numbers. */
  measureList(initial: Partial<ListMetrics>): ListMetrics;
}

interface HarnessOptions {
  history?: ChatMessage[];
  rooms?: ChatRoom[];
  members?: GroupMember[];
  status?: ConnectionStatus;
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const handlers = new Map<string, (data: unknown) => void>();

  const chat = {
    getRooms: vi.fn().mockResolvedValue(options.rooms ?? [room()]),
    getGroupMembers: vi.fn().mockResolvedValue(options.members ?? []),
    getLatestMessages: vi.fn().mockResolvedValue(options.history ?? []),
    getMessages: vi.fn().mockResolvedValue([]),
    markRoomRead: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn(),
    getMessageReceipts: vi.fn().mockResolvedValue({ readBy: [], totalMembers: 1 }),
  };
  const centrifuge = {
    isConnected: signal(true),
    connectionStatus: signal<ConnectionStatus>(options.status ?? 'connected'),
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((channel: string, handler: (data: unknown) => void) => {
      handlers.set(channel, handler);
      return { unsubscribe: vi.fn() };
    }),
    unsubscribe: vi.fn(),
  };
  const typing = {
    typingUsers: signal<TypingUser[]>([]),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendTyping: vi.fn(),
  };

  await TestBed.configureTestingModule({
    imports: [ChatRoomComponent],
    providers: [
      { provide: ChatService, useValue: chat },
      { provide: CentrifugeService, useValue: centrifuge },
      {
        provide: AuthService,
        useValue: {
          currentUser: signal({ id: ME, display_name: 'Me' }),
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
      { provide: TypingService, useValue: typing },
      {
        provide: VocabularyStore,
        useValue: {
          translateWordOrSentence: vi.fn(),
          saveWord: vi.fn(),
          updateSrsLevel: vi.fn(),
          getWordStatus: vi.fn().mockReturnValue({ colourClass: '' }),
          checkGrammar: vi.fn().mockResolvedValue({
            original: '',
            corrected: '',
            explanation: '',
            errors_found: 0,
          }),
        },
      },
      {
        provide: DraftService,
        useValue: {
          saveChatDraft: vi.fn(),
          saveChatDraftV2: vi.fn(),
          loadChatDraft: vi.fn().mockReturnValue(null),
          loadChatDraftV2: vi.fn().mockReturnValue(null),
          clearChatDraft: vi.fn(),
          clearChatDraftV2: vi.fn(),
        },
      },
      { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
      { provide: TextToSpeechService, useValue: { speak: vi.fn() } },
      I18nService,
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ChatRoomComponent);
  fixture.componentRef.setInput('id', ROOM_ID);

  const harness: Harness = {
    fixture,
    component: fixture.componentInstance,
    chat,
    centrifuge,
    typing,
    i18n: TestBed.inject(I18nService),
    publish: (payload) => handlers.get(`chat:${ROOM_ID}`)?.(payload),
    settle: async () => {
      for (let round = 0; round < 3; round++) {
        fixture.detectChanges();
        await flush();
      }
      fixture.detectChanges();
    },
    root: () => fixture.nativeElement,
    list: () => {
      const list = fixture.nativeElement.querySelector('[role="log"]');
      if (!(list instanceof HTMLElement)) throw new Error('message list is not rendered');
      return list;
    },
    measureList: (initial) => {
      const metrics: ListMetrics = {
        scrollHeight: 1000,
        clientHeight: 400,
        scrollTop: 600,
        ...initial,
      };
      const list = harness.list();
      Object.defineProperty(list, 'scrollHeight', {
        configurable: true,
        get: () => metrics.scrollHeight,
      });
      Object.defineProperty(list, 'clientHeight', {
        configurable: true,
        get: () => metrics.clientHeight,
      });
      Object.defineProperty(list, 'scrollTop', {
        configurable: true,
        get: () => metrics.scrollTop,
        set: (value: number) => {
          metrics.scrollTop = value;
        },
      });
      return metrics;
    },
  };

  await harness.settle();
  return harness;
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function bubbles(harness: Harness): HTMLElement[] {
  return Array.from(harness.root().querySelectorAll<HTMLElement>('[data-testid="chat-message"]'));
}

function receipts(harness: Harness): HTMLElement[] {
  return Array.from(harness.root().querySelectorAll<HTMLElement>('app-read-receipt'));
}

describe('ChatRoomComponent real-time message stream', () => {
  afterEach(() => {
    // Restore the jsdom default visibility for the next test.
    Reflect.deleteProperty(document, 'visibilityState');
    vi.restoreAllMocks();
  });

  describe('history', () => {
    it('fails closed when the requested room is absent from the membership-scoped room list', async () => {
      const harness = await createHarness({ rooms: [] });

      expect(harness.component.roomDetailsUnavailable()).toBe(true);
      expect(harness.chat.getLatestMessages).not.toHaveBeenCalled();
      expect(harness.centrifuge.subscribe).not.toHaveBeenCalled();
      expect(harness.typing.connect).not.toHaveBeenCalled();
      expect(harness.root().querySelector('[data-testid="send-button"]')).toBeNull();
    });

    it('loads the newest page from the network-first endpoint and renders it', async () => {
      const harness = await createHarness({ history: [message('a', 1), message('b', 2)] });

      expect(harness.chat.getLatestMessages).toHaveBeenCalledWith(ROOM_ID, {
        limit: CHAT_HISTORY_PAGE_SIZE,
      });
      expect(harness.chat.getMessages).not.toHaveBeenCalled();
      expect(bubbles(harness)).toHaveLength(2);
      expect(harness.component.isLoading()).toBe(false);
      expect(harness.component.hasEarlierMessages()).toBe(false);
    });

    it('shows the translated empty state for a room with no messages', async () => {
      const harness = await createHarness({ history: [] });

      const empty = harness.i18n.translate('chatRoom.empty');
      expect(empty).not.toBe('chatRoom.empty');
      expect(harness.root().textContent).toContain(empty);
    });

    it('shows a retryable unavailable state when history cannot be loaded, then recovers', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const harness = await createHarness();
      harness.chat.getLatestMessages.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

      await harness.component.loadMessages();
      harness.fixture.detectChanges();

      expect(harness.component.historyError()).toBe('unavailable');
      const alert = harness.root().querySelector('[role="alert"]');
      expect(alert?.textContent).toContain(harness.i18n.translate('chatRoom.historyUnavailable'));

      harness.chat.getLatestMessages.mockResolvedValueOnce([message('a', 1)]);
      const retry = Array.from(alert?.querySelectorAll('button') ?? []).find(
        (button) => button.textContent?.trim() === harness.i18n.translate('common.retry'),
      );
      retry?.click();
      await harness.settle();

      expect(harness.component.historyError()).toBeNull();
      expect(bubbles(harness)).toHaveLength(1);
    });

    it('explains an authorisation failure instead of pretending the room is empty', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const harness = await createHarness();
      harness.chat.getLatestMessages.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));

      await harness.component.loadMessages();
      harness.fixture.detectChanges();

      expect(harness.component.historyError()).toBe('forbidden');
      expect(harness.root().textContent).toContain(
        harness.i18n.translate('chatRoom.historyForbidden'),
      );
      expect(harness.root().textContent).not.toContain(harness.i18n.translate('chatRoom.empty'));
    });

    it('offers earlier messages for a full page and prepends them without duplicates', async () => {
      const first = fullPage();
      const harness = await createHarness({ history: first });
      expect(harness.component.hasEarlierMessages()).toBe(true);

      const older = [message('older-1', 1), message('older-2', 2), first[0]];
      harness.chat.getLatestMessages.mockResolvedValueOnce(older);

      await harness.component.loadEarlierMessages();
      harness.fixture.detectChanges();

      expect(harness.chat.getLatestMessages).toHaveBeenLastCalledWith(ROOM_ID, {
        before: first[0].created_at,
        limit: CHAT_HISTORY_PAGE_SIZE,
      });
      expect(
        harness.component
          .messages()
          .map((m) => m.id)
          .slice(0, 3),
      ).toEqual(['older-1', 'older-2', 'page-0']);
      expect(harness.component.messages()).toHaveLength(CHAT_HISTORY_PAGE_SIZE + 2);
      expect(harness.component.hasEarlierMessages()).toBe(false);
    });

    it('renders the earlier-messages control as a labelled button that reports when it is busy', async () => {
      const harness = await createHarness({ history: fullPage() });
      const control = (): HTMLButtonElement | null =>
        harness.root().querySelector<HTMLButtonElement>('[data-testid="load-earlier"]');
      const requestsBefore = harness.chat.getLatestMessages.mock.calls.length;

      expect(control()?.dataset['slot']).toBe('button');
      expect(control()?.type).toBe('button');
      expect(control()?.textContent?.trim()).toBe(harness.i18n.translate('chatRoom.loadEarlier'));
      expect(control()?.disabled).toBe(false);
      expect(control()?.getAttribute('aria-busy')).toBe('false');

      let resolveOlder!: (messages: ChatMessage[]) => void;
      harness.chat.getLatestMessages.mockImplementationOnce(
        () => new Promise<ChatMessage[]>((resolve) => (resolveOlder = resolve)),
      );
      control()?.click();
      harness.fixture.detectChanges();

      expect(control()?.disabled).toBe(true);
      expect(control()?.getAttribute('aria-busy')).toBe('true');
      expect(control()?.textContent?.trim()).toBe(
        harness.i18n.translate('chatRoom.loadingEarlier'),
      );

      // A repeated activation while a page is loading must not request another page.
      control()?.click();
      await harness.component.loadEarlierMessages();
      expect(harness.chat.getLatestMessages).toHaveBeenCalledTimes(requestsBefore + 1);

      resolveOlder([message('older-1', 1)]);
      await harness.settle();

      expect(harness.component.messages()[0].id).toBe('older-1');
      // A short page means the start of the conversation was reached.
      expect(control()).toBeNull();
    });

    it('keeps the loaded conversation and offers a retry when earlier history fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const harness = await createHarness({ history: fullPage() });
      harness.chat.getLatestMessages.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));

      await harness.component.loadEarlierMessages();
      harness.fixture.detectChanges();

      expect(harness.component.loadEarlierError()).toBe(true);
      expect(harness.component.messages()).toHaveLength(CHAT_HISTORY_PAGE_SIZE);
      expect(harness.root().textContent).toContain(
        harness.i18n.translate('chatRoom.loadEarlierFailed'),
      );

      harness.chat.getLatestMessages.mockResolvedValueOnce([message('older-1', 1)]);
      await harness.component.loadEarlierMessages();

      expect(harness.component.loadEarlierError()).toBe(false);
      expect(harness.component.messages()[0].id).toBe('older-1');
    });

    it('ignores a slow history response for a room the reader has already left', async () => {
      const harness = await createHarness();
      let resolveStale!: (messages: ChatMessage[]) => void;
      harness.chat.getLatestMessages.mockImplementationOnce(
        () => new Promise<ChatMessage[]>((resolve) => (resolveStale = resolve)),
      );
      const pending = harness.component.loadMessages();

      harness.fixture.componentRef.setInput('id', 'room-2');
      harness.fixture.detectChanges();
      await flush();
      resolveStale([message('stale', 1, { room_id: ROOM_ID })]);
      await pending;

      expect(harness.component.messages().map((m) => m.id)).not.toContain('stale');
    });
  });

  describe('live updates', () => {
    it('subscribes to the room channel and starts typing sync for the room', async () => {
      const harness = await createHarness();

      expect(harness.centrifuge.subscribe).toHaveBeenCalledWith(
        `chat:${ROOM_ID}`,
        expect.any(Function),
      );
      expect(harness.typing.connect).toHaveBeenCalledWith(ROOM_ID);
    });

    it('appends a message published to the room and acknowledges it in one bulk request', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      harness.chat.markRoomRead.mockClear();

      harness.publish({ message: message('live', 5) });
      await harness.settle();

      expect(harness.component.messages().map((m) => m.id)).toEqual(['a', 'live']);
      expect(bubbles(harness)).toHaveLength(2);
      expect(harness.chat.markRoomRead).toHaveBeenCalledTimes(1);
      expect(harness.chat.markRoomRead).toHaveBeenCalledWith(ROOM_ID, ['live']);
    });

    it('never acknowledges the reader own messages, system events or already read messages', async () => {
      const harness = await createHarness();
      harness.chat.markRoomRead.mockClear();

      harness.publish({ message: ownMessage('mine', 2) });
      harness.publish({ message: message('done', 3, { delivery_status: 'read', is_read: true }) });
      await harness.settle();

      expect(harness.chat.markRoomRead).not.toHaveBeenCalled();
    });

    it('ignores publications for another room and malformed payloads', async () => {
      const harness = await createHarness();

      harness.publish({ message: message('other', 2, { room_id: 'room-9' }) });
      harness.publish('not an object');
      harness.publish({ status_update: { message_id: 42, delivery_status: 'read' } });
      await harness.settle();

      expect(harness.component.messages()).toEqual([]);
    });

    it('catches up from the API when the connection returns, keeping messages it already has', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      harness.chat.getLatestMessages.mockClear();
      harness.chat.getLatestMessages.mockResolvedValue([
        message('a', 1, { is_read: true }),
        message('missed', 2, { is_read: true }),
      ]);

      harness.centrifuge.connectionStatus.set('reconnecting');
      await harness.settle();
      expect(harness.chat.getLatestMessages).not.toHaveBeenCalled();

      harness.centrifuge.connectionStatus.set('connected');
      await harness.settle();

      expect(harness.chat.getLatestMessages).toHaveBeenCalledWith(ROOM_ID, {
        limit: CHAT_HISTORY_PAGE_SIZE,
      });
      expect(harness.component.messages().map((m) => m.id)).toEqual(['a', 'missed']);
    });

    it('catches up once the connection becomes active after the room subscribed', async () => {
      const harness = await createHarness({
        history: [message('a', 1, { is_read: true })],
        status: 'connecting',
      });
      harness.chat.getLatestMessages.mockClear();
      harness.chat.getLatestMessages.mockResolvedValue([
        message('a', 1, { is_read: true }),
        message('raced', 2, { is_read: true }),
      ]);

      harness.centrifuge.connectionStatus.set('connected');
      await harness.settle();

      expect(harness.component.messages().map((m) => m.id)).toEqual(['a', 'raced']);
    });

    it('does not fetch a locked room while its content is hidden', async () => {
      const harness = await createHarness({ rooms: [room({ is_locked: true })] });

      expect(harness.component.pendingUnlock()).toBe(true);
      expect(harness.chat.getLatestMessages).not.toHaveBeenCalled();
      expect(harness.centrifuge.subscribe).not.toHaveBeenCalled();
    });

    it('surfaces an authorisation change discovered while catching up', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      harness.chat.getLatestMessages.mockRejectedValue(new HttpErrorResponse({ status: 403 }));

      harness.centrifuge.connectionStatus.set('reconnecting');
      await harness.settle();
      harness.centrifuge.connectionStatus.set('connected');
      await harness.settle();

      expect(harness.component.historyError()).toBe('forbidden');
    });

    it('releases the subscription and typing sync when the room is closed', async () => {
      const harness = await createHarness();

      harness.fixture.destroy();

      expect(harness.centrifuge.unsubscribe).toHaveBeenCalledWith(`chat:${ROOM_ID}`);
      expect(harness.typing.disconnect).toHaveBeenCalled();
    });

    it('warns the reader when live updates are unavailable', async () => {
      const harness = await createHarness({ status: 'error' });

      const alert = harness.root().querySelector('[role="alert"]');
      expect(alert?.textContent).toContain(harness.i18n.translate('chatRoom.connectionError'));
    });
  });

  describe('read receipts', () => {
    it('shows a receipt only on the reader own messages and labels the newest one', async () => {
      const harness = await createHarness({
        history: [
          ownMessage('mine-1', 1, { delivery_status: 'delivered' }),
          message('theirs', 2, { is_read: true }),
          ownMessage('mine-2', 3, { delivery_status: 'delivered' }),
        ],
      });

      const shown = receipts(harness);
      expect(shown).toHaveLength(2);

      const delivered = harness.i18n.translate('readReceipts.delivered');
      // Both announce the state to assistive technology; only the newest shows it as text.
      expect(shown[0].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(delivered);
      expect(shown[1].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(delivered);
      expect(shown[0].textContent?.trim()).toBe('');
      expect(shown[1].textContent?.trim()).toBe(delivered);
    });

    it('moves a receipt forward from live status updates and never backwards', async () => {
      const harness = await createHarness({
        history: [ownMessage('mine', 1, { delivery_status: 'sent' })],
      });
      const label = (): string | null | undefined =>
        receipts(harness)[0]?.querySelector('[role="img"]')?.getAttribute('aria-label');
      expect(label()).toBe(harness.i18n.translate('readReceipts.sent'));

      harness.publish({ status_update: { message_id: 'mine', delivery_status: 'read' } });
      await harness.settle();
      expect(label()).toBe(harness.i18n.translate('readReceipts.read'));

      harness.publish({ status_update: { message_id: 'mine', delivery_status: 'delivered' } });
      await harness.settle();
      expect(label()).toBe(harness.i18n.translate('readReceipts.read'));
    });

    it('treats a one-to-one room as a single recipient and a group room as an audience', async () => {
      const oneToOne = await createHarness({
        history: [ownMessage('mine', 1, { delivery_status: 'read' })],
      });
      expect(oneToOne.component.isGroupChat()).toBe(false);
      expect(oneToOne.root().querySelector('[data-testid="read-receipt-details"]')).toBeNull();
      TestBed.resetTestingModule();

      const group = await createHarness({
        rooms: [room({ admin_id: ME })],
        history: [ownMessage('mine', 1, { delivery_status: 'read' })],
      });
      expect(group.component.isGroupChat()).toBe(true);
      const details = group.root().querySelector('[data-testid="read-receipt-details"]');
      expect(details?.getAttribute('aria-label')).toContain(
        group.i18n.translate('readReceipts.readByAll'),
      );
    });

    it('only acknowledges reads while the page is visible, then catches up when it returns', async () => {
      const harness = await createHarness();
      harness.chat.markRoomRead.mockClear();

      setVisibility('hidden');
      harness.publish({ message: message('while-away', 4) });
      await harness.settle();
      expect(harness.chat.markRoomRead).not.toHaveBeenCalled();

      setVisibility('visible');
      await harness.settle();
      expect(harness.chat.markRoomRead).toHaveBeenCalledTimes(1);
      expect(harness.chat.markRoomRead).toHaveBeenCalledWith(ROOM_ID, ['while-away']);
    });

    it('does not resend an acknowledgement the API already accepted', async () => {
      const harness = await createHarness();
      harness.chat.markRoomRead.mockClear();
      harness.publish({ message: message('once', 4) });
      await harness.settle();
      expect(harness.chat.markRoomRead).toHaveBeenCalledTimes(1);

      setVisibility('hidden');
      setVisibility('visible');
      await harness.settle();

      expect(harness.chat.markRoomRead).toHaveBeenCalledTimes(1);
    });

    it('retries an acknowledgement that failed, because delivery of receipts is best effort', async () => {
      const harness = await createHarness();
      harness.chat.markRoomRead.mockClear();
      harness.chat.markRoomRead.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
      harness.publish({ message: message('retry', 4) });
      await harness.settle();

      setVisibility('hidden');
      setVisibility('visible');
      await harness.settle();

      expect(harness.chat.markRoomRead).toHaveBeenCalledTimes(2);
    });
  });

  describe('typing indicator', () => {
    it('names typists from the room roster and falls back to a translated placeholder', async () => {
      const harness = await createHarness({
        members: [
          { user_id: ME, user: { id: ME, display_name: 'Me' } },
          { user_id: PARTNER, user: { id: PARTNER, display_name: 'Alice' } },
        ],
      });

      harness.typing.typingUsers.set([{ userId: PARTNER, displayName: '' }]);
      await harness.settle();
      const status = harness.root().querySelector('app-typing-indicator [role="status"]');
      expect(status?.getAttribute('aria-label')).toBe(
        harness.i18n.translate('typingIndicator.single', { name: 'Alice' }),
      );

      harness.typing.typingUsers.set([{ userId: 'stranger', displayName: '' }]);
      await harness.settle();
      expect(
        harness
          .root()
          .querySelector('app-typing-indicator [role="status"]')
          ?.getAttribute('aria-label'),
      ).toBe(
        harness.i18n.translate('typingIndicator.single', {
          name: harness.i18n.translate('typingIndicator.someone'),
        }),
      );
    });

    it('draws an avatar only from roster data and falls back to an initial otherwise', async () => {
      const harness = await createHarness({
        members: [
          {
            user_id: PARTNER,
            user: {
              id: PARTNER,
              display_name: 'Alice',
              avatar_url: 'https://cdn.example/alice.png',
            },
          },
        ],
      });

      harness.typing.typingUsers.set([
        // A payload-supplied avatar must never be shown.
        { userId: PARTNER, displayName: 'Alice', avatarUrl: 'https://tracker.example/pixel.png' },
        { userId: 'stranger', displayName: '' },
      ]);
      await harness.settle();

      const images = Array.from(
        harness.root().querySelectorAll<HTMLImageElement>('app-typing-indicator img'),
      );
      expect(images.map((image) => image.getAttribute('src'))).toEqual([
        'https://cdn.example/alice.png',
      ]);
      expect(harness.root().querySelector('app-typing-indicator')?.textContent).toContain(
        harness.i18n.translate('typingIndicator.someone').charAt(0).toUpperCase(),
      );
    });

    it('shows nothing when nobody is typing', async () => {
      const harness = await createHarness();

      expect(harness.root().querySelector('app-typing-indicator [role="status"]')).toBeNull();
    });

    it('reports composing to the typing service and stops when the message is sent', async () => {
      const harness = await createHarness();
      harness.chat.sendMessage.mockResolvedValue(ownMessage('sent', 9));
      const input = document.createElement('input');
      input.value = 'Hola';

      harness.component.onComposerInput({ target: input } as unknown as Event);
      expect(harness.typing.sendTyping).toHaveBeenLastCalledWith(true);

      input.value = '';
      harness.component.onComposerInput({ target: input } as unknown as Event);
      expect(harness.typing.sendTyping).toHaveBeenLastCalledWith(false);

      harness.component.textInput = 'Hola';
      await harness.component.sendTextMessage();
      expect(harness.typing.sendTyping).toHaveBeenLastCalledWith(false);
    });
  });

  describe('following the conversation', () => {
    it('starts at the newest message once the first page has rendered', async () => {
      const harness = await createHarness();
      const metrics = harness.measureList({ scrollTop: 0, scrollHeight: 2000 });

      harness.chat.getLatestMessages.mockResolvedValueOnce([message('a', 1), message('b', 2)]);
      await harness.component.loadMessages();
      await harness.settle();

      expect(metrics.scrollTop).toBe(2000);
    });

    it('scrolls new messages into view while the reader is at the bottom', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      const metrics = harness.measureList({
        scrollTop: 600,
        scrollHeight: 1000,
        clientHeight: 400,
      });

      metrics.scrollHeight = 1100;
      harness.publish({ message: message('live', 5) });
      await harness.settle();

      expect(metrics.scrollTop).toBe(1100);
      expect(harness.component.unseenMessageCount()).toBe(0);
    });

    it('leaves the reading position alone and counts unseen messages when scrolled away', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      const metrics = harness.measureList({
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      harness.list().dispatchEvent(new Event('scroll'));

      harness.publish({ message: message('live-1', 5) });
      harness.publish({ message: message('live-2', 6) });
      await harness.settle();

      expect(metrics.scrollTop).toBe(100);
      expect(harness.component.unseenMessageCount()).toBe(2);
      const jump = harness.root().querySelector('[data-testid="jump-to-latest"]');
      expect(jump?.textContent?.trim()).toBe(
        harness.i18n.translate('chatRoom.newMessages', { count: 2 }),
      );
      expect(jump?.getAttribute('title')).toBe(harness.i18n.translate('chatRoom.jumpToLatest'));
    });

    it('uses the singular label for one unseen message and ignores system events', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      harness.measureList({ scrollTop: 100 });
      harness.list().dispatchEvent(new Event('scroll'));

      harness.publish({
        message: {
          id: 'sys-1',
          room_id: ROOM_ID,
          sender_id: '',
          message_type: 'system',
          created_at: minutesAfterStart(5),
          is_read: false,
          system_event: { type: 'memberAdded', count: 1 },
        },
      });
      harness.publish({ message: message('live', 6) });
      await harness.settle();

      expect(harness.component.unseenMessageCount()).toBe(1);
      expect(
        harness.root().querySelector('[data-testid="jump-to-latest"]')?.textContent?.trim(),
      ).toBe(harness.i18n.translate('chatRoom.newMessage'));
    });

    it('jumps to the latest message, clears the count and acknowledges what was unseen', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      const metrics = harness.measureList({
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      harness.list().dispatchEvent(new Event('scroll'));
      harness.chat.markRoomRead.mockClear();
      harness.publish({ message: message('live', 5) });
      await harness.settle();
      expect(harness.chat.markRoomRead).not.toHaveBeenCalled();

      metrics.scrollHeight = 1200;
      const jump = harness
        .root()
        .querySelector<HTMLButtonElement>('[data-testid="jump-to-latest"]');
      jump?.click();
      await harness.settle();

      expect(metrics.scrollTop).toBe(1200);
      expect(harness.component.unseenMessageCount()).toBe(0);
      expect(harness.root().querySelector('[data-testid="jump-to-latest"]')).toBeNull();
      expect(harness.chat.markRoomRead).toHaveBeenCalledWith(ROOM_ID, ['live']);
    });

    it('clears the count and acknowledges messages when the reader scrolls back down themselves', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      const metrics = harness.measureList({
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      harness.list().dispatchEvent(new Event('scroll'));
      harness.chat.markRoomRead.mockClear();
      harness.publish({ message: message('live', 5) });
      await harness.settle();
      expect(harness.component.unseenMessageCount()).toBe(1);

      metrics.scrollTop = 590;
      harness.list().dispatchEvent(new Event('scroll'));
      await harness.settle();

      expect(harness.component.unseenMessageCount()).toBe(0);
      expect(harness.chat.markRoomRead).toHaveBeenCalledWith(ROOM_ID, ['live']);
    });

    it('always brings the reader own message into view, even from further up', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      const metrics = harness.measureList({
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      harness.list().dispatchEvent(new Event('scroll'));
      harness.chat.sendMessage.mockResolvedValue(ownMessage('sent', 9));

      metrics.scrollHeight = 1100;
      harness.component.textInput = 'Hola';
      await harness.component.sendTextMessage();
      await harness.settle();

      expect(metrics.scrollTop).toBe(1100);
      expect(harness.component.unseenMessageCount()).toBe(0);
    });

    it('keeps the same message under the reader when earlier history is inserted above', async () => {
      const first = fullPage();
      const harness = await createHarness({ history: first });
      const metrics = harness.measureList({ scrollTop: 50, scrollHeight: 1000, clientHeight: 400 });
      harness.list().dispatchEvent(new Event('scroll'));
      harness.chat.getLatestMessages.mockResolvedValueOnce([
        message('older-1', 1),
        message('older-2', 2),
      ]);

      // The component records the list height before inserting the older page...
      await harness.component.loadEarlierMessages();
      // ...and the rendered list is then 600px taller, as it would be in a browser.
      metrics.scrollHeight = 1600;
      harness.fixture.detectChanges();

      expect(metrics.scrollTop).toBe(650);
      expect(harness.component.unseenMessageCount()).toBe(0);
    });

    it('does not pull the reader down when only a receipt changes', async () => {
      const harness = await createHarness({
        history: [ownMessage('mine', 1, { delivery_status: 'sent' })],
      });
      const metrics = harness.measureList({
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      harness.list().dispatchEvent(new Event('scroll'));

      harness.publish({ status_update: { message_id: 'mine', delivery_status: 'delivered' } });
      await harness.settle();

      expect(metrics.scrollTop).toBe(100);
      expect(harness.component.unseenMessageCount()).toBe(0);
    });

    it('resets the unseen count when the reader opens a different room', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      harness.measureList({ scrollTop: 100 });
      harness.list().dispatchEvent(new Event('scroll'));
      harness.publish({ message: message('live', 5) });
      await harness.settle();
      expect(harness.component.unseenMessageCount()).toBe(1);

      harness.chat.getLatestMessages.mockResolvedValue([]);
      harness.fixture.componentRef.setInput('id', 'room-2');
      await harness.settle();

      expect(harness.component.unseenMessageCount()).toBe(0);
      expect(harness.root().querySelector('[data-testid="jump-to-latest"]')).toBeNull();
    });
  });

  describe('accessibility', () => {
    const announcement = (harness: Harness): string =>
      harness.root().querySelector('[data-testid="incoming-announcement"]')?.textContent?.trim() ??
      '';

    it('exposes the conversation as a labelled log that is not read out message by message', async () => {
      const harness = await createHarness({ history: [message('a', 1), message('b', 2)] });

      const log = harness.list();
      expect(log.getAttribute('aria-live')).toBe('off');
      expect(log.getAttribute('aria-label')).toBe(harness.i18n.translate('chatRoom.messagesLabel'));
      // Opening a conversation must not be announced as if each message had just arrived.
      expect(announcement(harness)).toBe('');
    });

    it('does not announce earlier history that is loaded above the reader', async () => {
      const harness = await createHarness({ history: fullPage() });
      harness.chat.getLatestMessages.mockResolvedValueOnce([
        message('older-1', 1),
        message('older-2', 2),
      ]);

      await harness.component.loadEarlierMessages();
      await harness.settle();

      expect(announcement(harness)).toBe('');
    });

    it('announces one incoming message through a separate polite status region', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });

      harness.publish({ message: message('live', 5, { text_content: 'Hola, que tal?' }) });
      await harness.settle();

      const region = harness.root().querySelector('[data-testid="incoming-announcement"]');
      expect(region?.getAttribute('role')).toBe('status');
      expect(region?.getAttribute('aria-live')).toBe('polite');
      expect(announcement(harness)).toBe(
        harness.i18n.translate('chatRoom.incomingMessage', {
          name: 'Emma',
          text: 'Hola, que tal?',
        }),
      );
    });

    it('summarises several messages that arrive together instead of reading each one', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });

      harness.publish({ message: message('live-1', 5) });
      harness.publish({ message: message('live-2', 6) });
      await harness.settle();

      expect(announcement(harness)).toBe(
        harness.i18n.translate('chatRoom.newMessages', { count: 2 }),
      );
    });

    it('names the sender without reading out a message that has no text', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });

      harness.publish({
        message: message('voice-1', 5, {
          message_type: 'voice',
          text_content: undefined,
          media_url: 'https://cdn.example/voice.webm',
        }),
      });
      await harness.settle();

      expect(announcement(harness)).toBe(
        harness.i18n.translate('chatRoom.incomingOtherMessage', { name: 'Emma' }),
      );
    });

    it('cuts a very long message so it cannot monopolise a screen reader', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });

      harness.publish({ message: message('long', 5, { text_content: 'x'.repeat(500) }) });
      await harness.settle();

      const spoken = announcement(harness);
      expect(spoken).toContain('x'.repeat(200) + '...');
      expect(spoken).not.toContain('x'.repeat(201));
    });

    it('never cuts an emoji sequence in half when shortening a long message', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      const family = '👨‍👩‍👧';

      // The 200th user-perceived character is a multi-code-point emoji.
      harness.publish({
        message: message('emoji', 5, { text_content: `${'a'.repeat(199)}${family}tail` }),
      });
      await harness.settle();

      const spoken = announcement(harness);
      expect(spoken).toContain(`${'a'.repeat(199)}${family}...`);
      expect(spoken).not.toContain('tail');
    });

    it('stays silent for the reader own messages and for system events', async () => {
      const harness = await createHarness({ history: [message('a', 1, { is_read: true })] });
      harness.chat.sendMessage.mockResolvedValue(ownMessage('sent', 9));

      harness.component.textInput = 'Hola';
      await harness.component.sendTextMessage();
      harness.publish({
        message: {
          id: 'sys-1',
          room_id: ROOM_ID,
          sender_id: '',
          message_type: 'system',
          created_at: minutesAfterStart(10),
          is_read: false,
          system_event: { type: 'memberAdded', count: 1 },
        },
      });
      await harness.settle();

      expect(announcement(harness)).toBe('');
    });

    it('labels the composer for assistive technology', async () => {
      const harness = await createHarness();

      const input = harness.root().querySelector('[data-testid="chat-message-input"]');
      expect(input?.getAttribute('aria-label')).toBe(
        harness.i18n.translate('chatRoom.messageInput'),
      );
    });

    describe('replies and decorative glyphs', () => {
      const jumpControl = (harness: Harness): HTMLElement | null =>
        harness.root().querySelector<HTMLElement>('[data-testid="reply-jump"]');

      it('names the jump control after the message it points at instead of a placeholder', async () => {
        const harness = await createHarness({
          history: [
            message('parent', 1, { text_content: 'Where shall we meet?' }),
            message('child', 2, { reply_to_id: 'parent', text_content: 'At the cafe' }),
          ],
        });

        const control = jumpControl(harness);
        const label = control?.getAttribute('aria-label') ?? '';
        expect(label).toBe(
          harness.i18n.translate('chatRoom.jumpToReplied', {
            name: 'Emma',
            text: 'Where shall we meet?',
          }),
        );
        // Speech input addresses a control by what is on screen, so the visible
        // sender and text must be part of the accessible name.
        expect(label).toContain(control?.querySelector('span:first-child')?.textContent?.trim());
        expect(label).toContain(control?.querySelector('span:last-child')?.textContent?.trim());
        expect(label).not.toContain(harness.i18n.translate('chat.unknown_user'));
      });

      it('falls back to the preview sent with the message when the parent is not loaded', async () => {
        const harness = await createHarness({
          history: [
            message('child', 2, {
              reply_to_id: 'older-parent',
              reply_preview: {
                text_content: 'See you soon',
                sender_id: 'user-3',
                display_name: 'Kenji',
              },
            }),
          ],
        });

        expect(jumpControl(harness)?.getAttribute('aria-label')).toBe(
          harness.i18n.translate('chatRoom.jumpToReplied', { name: 'Kenji', text: 'See you soon' }),
        );
      });

      it('uses translated placeholders when nothing is known about the parent', async () => {
        const harness = await createHarness({
          history: [message('child', 2, { reply_to_id: 'deleted-parent' })],
        });

        expect(jumpControl(harness)?.getAttribute('aria-label')).toBe(
          harness.i18n.translate('chatRoom.jumpToReplied', {
            name: harness.i18n.translate('chat.unknown_user'),
            text: harness.i18n.translate('chatRoom.replyPreviewFallback'),
          }),
        );
      });

      it('cuts a very long quoted message in the accessible name but not on screen', async () => {
        const harness = await createHarness({
          history: [
            message('parent', 1, { text_content: 'y'.repeat(500) }),
            message('child', 2, { reply_to_id: 'parent' }),
          ],
        });

        const control = jumpControl(harness);
        expect(control?.getAttribute('aria-label')).toContain('y'.repeat(200) + '...');
        expect(control?.getAttribute('aria-label')).not.toContain('y'.repeat(201));
        expect(control?.textContent).toContain('y'.repeat(500));
      });

      it('scrolls to and highlights the replied message when activated', async () => {
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: scrollIntoView,
        });
        try {
          const harness = await createHarness({
            history: [message('parent', 1), message('child', 2, { reply_to_id: 'parent' })],
          });

          vi.useFakeTimers();
          jumpControl(harness)?.click();
          harness.fixture.detectChanges();

          expect(scrollIntoView).toHaveBeenCalledTimes(1);
          expect(harness.component.highlightedMessageId()).toBe('parent');
          vi.advanceTimersByTime(1500);
          expect(harness.component.highlightedMessageId()).toBeNull();
        } finally {
          vi.useRealTimers();
          Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
        }
      });

      it('hides the decorative room glyph from assistive technology', async () => {
        const harness = await createHarness();

        const glyph = Array.from(harness.root().querySelectorAll('[aria-hidden="true"]')).find(
          (element) => element.textContent?.trim() === '💬',
        );
        expect(glyph).toBeTruthy();
      });

      it('hides the decorative pencil from the correction request note', async () => {
        const harness = await createHarness({
          history: [
            message('request', 1, {
              message_type: 'correction_request',
              text_content: undefined,
              correction_request_payload: { original_text: 'I goed home' },
            }),
          ],
        });

        const note = harness.root().querySelector('p.text-warning');
        expect(note?.textContent).toContain(harness.i18n.translate('chatRoom.correctionRequested'));
        expect(note?.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('✏️');
      });
    });
  });

  describe('group participants', () => {
    const members: GroupMember[] = [
      { user_id: ME, user: { id: ME, display_name: 'Me' } },
      { user_id: PARTNER, user: { id: PARTNER, display_name: 'Emma' } },
    ];

    it('offers the participant drawer only in a group room, named with the member count', async () => {
      const oneToOne = await createHarness({ members });
      expect(oneToOne.root().querySelector('[data-testid="participants-button"]')).toBeNull();
      TestBed.resetTestingModule();

      const group = await createHarness({ rooms: [room({ admin_id: ME })], members });
      const button = group
        .root()
        .querySelector<HTMLButtonElement>('[data-testid="participants-button"]');

      expect(button?.dataset['slot']).toBe('button');
      expect(button?.type).toBe('button');
      expect(button?.getAttribute('aria-label')).toBe(
        group.i18n.translate('chatRoom.participantCount', { count: members.length }),
      );
      expect(button?.textContent).toContain(group.i18n.translate('chatRoom.participantsBtn'));
      expect(group.component.showParticipantDrawer()).toBe(false);

      button?.click();
      await group.settle();

      expect(group.component.showParticipantDrawer()).toBe(true);
      expect(group.root().querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
        group.i18n.translate('group.participants'),
      );
    });
  });

  describe('switching rooms', () => {
    it('does not reload the room when the reader picks a message to reply to afterwards', async () => {
      const harness = await createHarness({
        rooms: [room(), room({ id: 'room-2' })],
        history: [message('a', 1, { is_read: true })],
      });
      harness.chat.getLatestMessages.mockResolvedValue([
        message('b', 2, { room_id: 'room-2', is_read: true }),
      ]);

      harness.fixture.componentRef.setInput('id', 'room-2');
      await harness.settle();
      expect(harness.component.messages().map((m) => m.id)).toEqual(['b']);
      const loadsAfterSwitch = harness.chat.getLatestMessages.mock.calls.length;
      const roomLookupsAfterSwitch = harness.chat.getRooms.mock.calls.length;

      harness.component.startReply('b');
      await harness.settle();

      expect(harness.component.replyingTo()?.id).toBe('b');
      expect(harness.chat.getLatestMessages.mock.calls.length).toBe(loadsAfterSwitch);
      expect(harness.chat.getRooms.mock.calls.length).toBe(roomLookupsAfterSwitch);
    });

    it('starts the new room with no state left over from the previous one', async () => {
      const harness = await createHarness({
        rooms: [room({ admin_id: ME }), room({ id: 'room-2' })],
        history: [message('a', 1, { is_read: true })],
      });
      harness.publish({ message: message('live', 5) });
      await harness.settle();
      harness.chat.getLatestMessages.mockResolvedValue([]);

      harness.fixture.componentRef.setInput('id', 'room-2');
      await harness.settle();

      expect(harness.component.messages()).toEqual([]);
      expect(harness.component.isGroupChat()).toBe(false);
      expect(harness.component.replyingTo()).toBeNull();
      expect(harness.centrifuge.unsubscribe).toHaveBeenCalledWith(`chat:${ROOM_ID}`);
      expect(harness.centrifuge.subscribe).toHaveBeenCalledWith(
        'chat:room-2',
        expect.any(Function),
      );
      expect(harness.typing.connect).toHaveBeenLastCalledWith('room-2');
    });

    it('leaves the previous realtime channels before showing a locked room', async () => {
      const lockedRoom = room({ id: 'room-2', is_locked: true });
      const harness = await createHarness({
        rooms: [room(), lockedRoom],
        history: [message('a', 1, { is_read: true })],
      });
      const historyLoadsBeforeSwitch = harness.chat.getLatestMessages.mock.calls.length;

      harness.fixture.componentRef.setInput('id', lockedRoom.id);
      await harness.settle();

      expect(harness.component.pendingUnlock()).toBe(true);
      expect(harness.centrifuge.unsubscribe).toHaveBeenCalledWith(`chat:${ROOM_ID}`);
      expect(harness.typing.disconnect).toHaveBeenCalled();
      expect(harness.centrifuge.subscribe).not.toHaveBeenCalledWith(
        `chat:${lockedRoom.id}`,
        expect.any(Function),
      );
      expect(harness.chat.getLatestMessages).toHaveBeenCalledTimes(historyLoadsBeforeSwitch);
    });
  });
});
