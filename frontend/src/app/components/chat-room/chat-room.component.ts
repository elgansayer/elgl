import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButton } from '@spartan-ng/helm/button';
import { showToast, showErrorToast } from '../../services/toast.service';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import {
  CHAT_HISTORY_PAGE_SIZE,
  ChatService,
  ChatMessage,
  ChatRoom,
  GroupMember,
} from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TypingService } from '../../services/typing.service';
import { TypingIndicatorComponent } from '../primitives/typing-indicator/typing-indicator.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { DoodlePadComponent } from '../doodle-pad/doodle-pad.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { StickerPickerComponent } from '../sticker-picker/sticker-picker.component';
import { ChatSystemBubbleComponent } from '../chat-system-bubble/chat-system-bubble.component';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { CulturalTipComponent } from '../cultural-tip/cultural-tip.component';
import { ReplyPreviewComponent } from '../../chat/threaded-reply/threaded-reply.component';
import { LinkPreviewCardComponent } from '../link-preview-card/link-preview-card.component';
import {
  GroupParticipantDrawerComponent,
  GroupParticipant,
} from '../group-participant-drawer/group-participant-drawer.component';
import { ChatSearchComponent } from '../chat-search/chat-search.component';
import { ChatMediaShareComponent } from '../chat-media-share/chat-media-share.component';
import { ChatMediaMessageComponent } from '../chat-media-message/chat-media-message.component';
import { DraftService } from '../../services/draft.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppInputComponent } from '../primitives/input/input.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { ReadReceiptComponent } from '../read-receipt/read-receipt.component';
import {
  applyChatRoomRealtimeEvent,
  effectiveDeliveryStatus,
  prependOlderMessages,
  reconcileLatestWindow,
} from './chat-room-realtime';

type HistoryError = 'forbidden' | 'unavailable';
type DeliveryStatus = 'sent' | 'delivered' | 'read';

/**
 * How close to the newest message (in CSS pixels) the reader must be for the
 * list to keep following the conversation. Further away, incoming messages are
 * announced with a "new messages" control instead of moving the reading position.
 */
const FOLLOW_LATEST_THRESHOLD_PX = 80;

/** Longest incoming message read out in full; longer ones are cut so a long paste cannot monopolise a screen reader. */
const MAX_ANNOUNCED_CHARACTERS = 200;

function isGroupMember(value: unknown): value is GroupMember {
  return (
    typeof value === 'object' &&
    value !== null &&
    'user_id' in value &&
    typeof value.user_id === 'string'
  );
}

function errorStatus(value: unknown): number | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'number'
  ) {
    return value.status;
  }
  return null;
}

@Component({
  selector: 'app-chat-room',
  imports: [
    HlmButton,
    ...HlmAutocompleteImports,
    CommonModule,
    TranslatePipe,
    TypingIndicatorComponent,
    VisualDiffComponent,
    DoodlePadComponent,
    VoiceRecorderComponent,
    TokenisedTextComponent,
    WordDefinitionModalComponent,
    LongPressContextMenuComponent,
    StickerPickerComponent,
    ChatSystemBubbleComponent,
    CulturalTipComponent,
    ReplyPreviewComponent,
    LinkPreviewCardComponent,
    GroupParticipantDrawerComponent,
    ChatSearchComponent,
    ChatMediaShareComponent,
    ChatMediaMessageComponent,
    AppCardComponent,
    AppInputComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
    ReadReceiptComponent,
  ],
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.scss'],
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
})
export class ChatRoomComponent {
  readonly centrifugeService = inject(CentrifugeService);
  private chatService = inject(ChatService);
  readonly authService = inject(AuthService);
  private userService = inject(UserService);
  readonly typingService = inject(TypingService);
  readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);
  private readonly tts = inject(TextToSpeechService);
  private readonly draftService = inject(DraftService);
  private readonly translationCache = inject(TranslationCacheService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  id = input.required<string>();
  private readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');

  constructor() {
    effect(() => {
      const roomId = this.id();
      // Only the room id may re-run this. Saving drafts reads other signals, and
      // tracking them would reload the whole room whenever, for example, the
      // reader chose a message to reply to after switching rooms.
      untracked(() => {
        if (this.roomId && this.roomId !== roomId) {
          // A locked destination returns before setupRealTime(), so tear down
          // the previous room here rather than relying on the next setup pass.
          this.releaseRealtimeResources();
          this.messages.set([]);
          this.participants.set([]);
          this.roomDetails.set(null);
          this.roomDetailsUnavailable.set(false);
          this.historyError.set(null);
          this.isLoading.set(true);
          this.isLocked.set(false);
          this.pendingUnlock.set(false);
          this.hasEarlierMessages.set(false);
          this.loadEarlierError.set(false);
          this.replyingTo.set(null);
          this.incomingAnnouncement.set('');
          this.followingLatest = true;
          this.pendingReadReceipts.clear();
          this.acknowledgedReadIds.clear();
        }
        this.roomId = roomId;
        void this.initializeRoom();
      });
    });

    // Whenever the transport reports a live connection while this room is
    // subscribed, publications may have been missed (a reconnect, or a
    // connection that only became active after the history request). The API
    // is the source of truth, so catch up from it.
    effect(() => {
      const status = this.centrifugeService.connectionStatus();
      const roomId = this.id();
      if (status !== 'connected') return;
      untracked(() => {
        if (this.subscribedRoomId === roomId) void this.reconcileAfterReconnect(roomId);
      });
    });

    // Scrolling is a side effect on a DOM node Angular does not own, so it is
    // driven from the rendered message list rather than from each code path
    // that adds a message (history, realtime, own sends, reconnect).
    effect(() => {
      const shown = this.filteredMessages();
      untracked(() => this.followMessageStream(shown));
    });

    effect(() => {
      if (this.visibleTypingUsers().length === 0) return;
      untracked(() => {
        if (this.followingLatest) this.scrollToLatestAfterRender();
      });
    });

    // Centrifugo subscriptions are imperative third-party resources, so they are
    // released explicitly when the component is destroyed.
    this.destroyRef.onDestroy(() => this.releaseRealtimeResources());
  }

  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isCheckingGrammar = signal<boolean>(false);
  readonly historyError = signal<HistoryError | null>(null);
  readonly isLoadingEarlier = signal(false);
  readonly loadEarlierError = signal(false);
  readonly hasEarlierMessages = signal(false);
  /** Messages from other people that arrived while the reader was scrolled away from the latest. */
  readonly unseenMessageCount = signal(0);
  /**
   * Spoken to assistive technology when someone else's message arrives. The
   * message list itself is not a live region, so opening a long conversation or
   * loading earlier history is never read out message by message.
   */
  readonly incomingAnnouncement = signal('');
  readonly unseenMessagesLabel = computed(() =>
    this.i18n.translate(
      this.unseenMessageCount() === 1 ? 'chatRoom.newMessage' : 'chatRoom.newMessages',
      { count: this.unseenMessageCount() },
    ),
  );
  readonly isTyping = signal<boolean>(false);
  readonly showDoodleModal = signal<boolean>(false);
  readonly showVoiceModal = signal<boolean>(false);
  readonly showCorrectionForm = signal<boolean>(false);
  readonly showStickerDrawer = signal<boolean>(false);
  readonly showSearch = signal<boolean>(false);
  readonly showAdminPanel = signal<boolean>(false);
  readonly showParticipantDrawer = signal<boolean>(false);
  readonly isLocked = signal<boolean>(false);
  readonly pendingUnlock = signal<boolean>(false);
  readonly autoPlayVoiceNotes = signal(false);
  readonly roomDetails = signal<ChatRoom | null>(null);
  readonly roomDetailsUnavailable = signal(false);

  readonly participants = signal<GroupMember[]>([]);
  readonly groupParticipants = computed<GroupParticipant[]>(() =>
    this.participants().map((m) => ({
      id: m.user_id,
      display_name: m.user?.display_name ?? this.i18n.translate('chatRoom.participantFallback'),
      avatar_url: m.user?.avatar_url ?? undefined,
      native_language: m.user?.native_language ?? '',
      target_languages: m.user?.target_languages ?? [],
      is_vip: m.user?.is_vip ?? false,
    })),
  );
  readonly isGroupChat = computed(() => Boolean(this.roomDetails()?.admin_id));
  readonly latestOwnMessageId = computed(() => {
    const currentUserId = this.authService.currentUser()?.id;
    for (let index = this.messages().length - 1; index >= 0; index--) {
      const message = this.messages()[index];
      if (message.sender_id === currentUserId) return message.id;
    }
    return null;
  });
  readonly visibleTypingUsers = computed(() =>
    this.typingService.typingUsers().map((user) => {
      const member = this.participants().find((candidate) => candidate.user_id === user.userId);
      return {
        ...user,
        displayName:
          member?.user?.display_name ||
          user.displayName ||
          this.i18n.translate('typingIndicator.someone'),
        // Avatars come only from the room roster, never from the typing payload.
        avatarUrl: member?.user?.avatar_url ?? undefined,
      };
    }),
  );
  readonly blockedUserIds = signal<string[]>([]);
  readonly partnerLanguage = signal<string | null>(null);
  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    return this.messages().filter((m) => !blocked.includes(m.sender_id));
  });

  readonly replyingTo = signal<ChatMessage | null>(null);
  readonly highlightedMessageId = signal<string | null>(null);
  readonly transliterations = signal<Record<string, string>>({});
  readonly translations = signal<Record<string, string>>({});
  readonly showTranslation = signal<Record<string, boolean>>({});
  readonly transcriptions = signal<Record<string, string>>({});
  readonly transcribingIds = signal<Set<string>>(new Set());
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');

  readonly mentionQuery = signal<string | null>(null);
  readonly mentionSuggestions = computed<GroupMember[]>(() => {
    const query = this.mentionQuery();
    if (query === null) return [];
    const currentUserId = this.authService.currentUser()?.id;
    const lowerQuery = query.toLowerCase();
    return this.participants()
      .filter(
        (member) =>
          member.user_id !== currentUserId &&
          (member.user?.display_name ?? '').toLowerCase().startsWith(lowerQuery),
      )
      .slice(0, 5);
  });
  private mentionRangeStart = 0;
  private mentionRangeEnd = 0;

  readonly mentionItemToString = (value: unknown): string => {
    if (!isGroupMember(value)) return this.textInput;
    const displayName = value.user?.display_name;
    if (!displayName) return this.textInput;
    return (
      this.textInput.slice(0, this.mentionRangeStart) +
      `@${displayName} ` +
      this.textInput.slice(this.mentionRangeEnd)
    );
  };

  roomId = '';
  searchQuery = '';
  showSearchPanel = signal(false);
  textInput = '';

  newGroupName = '';
  newMemberId = '';
  memberToRemoveId = '';

  originalText = '';
  correctedText = '';
  explanationText = '';

  private subscription: { unsubscribe: () => void } | null = null;
  private subscribedRoomId: string | null = null;
  private readonly pendingReadReceipts = new Set<string>();
  /** Messages already acknowledged as read in this room, so scrolling and reconnects never resend them. */
  private readonly acknowledgedReadIds = new Set<string>();
  private followingLatest = true;
  private jumpToLatestOnNextLoad = false;
  private shownMessageIds = new Set<string>();
  private latestShownAt = Number.NEGATIVE_INFINITY;

  private async initializeRoom(): Promise<void> {
    this.isLoading.set(true);
    this.historyError.set(null);
    this.roomDetailsUnavailable.set(false);
    this.pendingUnlock.set(false);
    const roomDetailsLoaded = await this.loadRoomDetails();
    if (!roomDetailsLoaded) return;

    if (this.isLocked()) {
      this.pendingUnlock.set(true);
      return;
    }
    await this.finishLoadingRoom();
  }

  private async finishLoadingRoom(): Promise<void> {
    await this.loadBlockedUsers();
    await this.loadMessages();
    this.restoreDraft();
    await this.setupRealTime();
    await this.loadParticipants();
    await this.resolvePartnerLanguage();
    await this.loadAutoPlayPreference();
  }

  private async loadAutoPlayPreference(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      this.autoPlayVoiceNotes.set(Boolean(profile?.auto_play_voice_notes));
    } catch {
      // keep default false
    }
  }

  async unlockRoom(): Promise<void> {
    await this.authService.unlockApp();
    if (!this.authService.appLocked()) {
      this.pendingUnlock.set(false);
      await this.finishLoadingRoom();
    }
  }

  async toggleLock(): Promise<void> {
    if (!this.roomId) return;
    try {
      if (this.isLocked()) {
        await this.chatService.unlockChat(this.roomId);
        this.isLocked.set(false);
        this.roomDetails.update((room) => (room ? { ...room, is_locked: false } : null));
        showToast(this.i18n.translate('chatList.chatUnlocked'), 'success');
      } else {
        await this.chatService.lockChat(this.roomId);
        this.isLocked.set(true);
        this.roomDetails.update((room) => (room ? { ...room, is_locked: true } : null));
        showToast(this.i18n.translate('chatList.chatLocked'), 'success');
      }
    } catch (e) {
      console.error('Failed to update chat lock status:', e);
      showErrorToast(this.i18n.translate('chatList.lockActionFailed'));
    }
  }

  async resolvePartnerLanguage(): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;
    try {
      const partner = this.participants().find((m) => m.user_id !== currentUserId);
      if (!partner) return;
      const profile = await this.userService.getUserProfile(partner.user_id);
      this.partnerLanguage.set(profile?.native_languages?.[0] ?? null);
    } catch (e) {
      console.error('Failed to resolve partner language:', e);
    }
  }

  async loadRoomDetails(): Promise<boolean> {
    const roomId = this.roomId;
    try {
      const rooms = await this.chatService.getRooms({ includeLocked: true });
      if (this.roomId !== roomId) return false;

      const details = rooms.find((room) => room.id === roomId) ?? null;
      if (!details) {
        // The room list is membership-scoped. An absent room is therefore not
        // authorised for this account (or no longer exists), so do not expose
        // history, composer controls, or realtime channel intent for it.
        this.roomDetails.set(null);
        this.roomDetailsUnavailable.set(true);
        this.isLoading.set(false);
        return false;
      }

      this.roomDetails.set(details);
      this.isLocked.set(details.is_locked ?? false);
      return true;
    } catch (e) {
      if (this.roomId !== roomId) return false;
      console.error('Failed to load room details:', e);
      this.roomDetails.set(null);
      this.roomDetailsUnavailable.set(true);
      this.isLoading.set(false);
      return false;
    }
  }

  async retryRoomDetails(): Promise<void> {
    await this.initializeRoom();
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg.sender_id === this.authService.currentUser()?.id;
  }

  deliveryStatusFor(message: ChatMessage): DeliveryStatus | undefined {
    return effectiveDeliveryStatus(message);
  }

  get isAdmin(): boolean {
    const currentUser = this.authService.currentUser();
    const details = this.roomDetails();
    return Boolean(currentUser && details?.admin_id === currentUser.id);
  }

  async loadBlockedUsers(): Promise<void> {
    try {
      const ids = await this.safetyService.getBlockedIdsAsync();
      this.blockedUserIds.set(ids);
    } catch (e) {
      console.error('Failed to load blocked users:', e);
    }
  }

  private releaseRealtimeResources(): void {
    if (this.subscribedRoomId) {
      this.centrifugeService.unsubscribe(`chat:${this.subscribedRoomId}`);
      this.subscribedRoomId = null;
      this.subscription = null;
    }
    this.pendingReadReceipts.clear();
    this.typingService.disconnect();
    this.saveChatDrafts();
  }

  saveChatDrafts(): void {
    this.draftService.saveChatDraft(this.roomId, this.textInput);
    this.draftService.saveChatDraftV2(this.roomId, {
      textInput: this.textInput,
      replyToId: this.replyingTo()?.id ?? null,
      originalText: this.originalText,
      correctedText: this.correctedText,
      explanationText: this.explanationText,
    });
  }

  private restoreDraft(): void {
    const simpleDraft = this.draftService.loadChatDraft(this.roomId);
    if (simpleDraft) this.textInput = simpleDraft;

    const v2Draft = this.draftService.loadChatDraftV2(this.roomId);
    if (v2Draft) {
      if (v2Draft.textInput) this.textInput = v2Draft.textInput;
      if (v2Draft.originalText) this.originalText = v2Draft.originalText;
      if (v2Draft.correctedText) this.correctedText = v2Draft.correctedText;
      if (v2Draft.explanationText) this.explanationText = v2Draft.explanationText;
      if (v2Draft.replyToId) this._restoredReplyToId = v2Draft.replyToId;
    }
  }

  private clearChatDrafts(): void {
    this.draftService.clearChatDraft(this.roomId);
    this.draftService.clearChatDraftV2(this.roomId);
  }

  private _restoredReplyToId: string | null = null;

  async loadMessages(): Promise<void> {
    const roomId = this.roomId;
    this.isLoading.set(true);
    this.historyError.set(null);
    this.loadEarlierError.set(false);
    try {
      const search = this.searchQuery.trim();
      const data = search
        ? await this.chatService.getMessages(roomId, search)
        : await this.chatService.getLatestMessages(roomId, {
            limit: CHAT_HISTORY_PAGE_SIZE,
          });
      if (this.roomId !== roomId) return;
      this.jumpToLatestOnNextLoad = true;
      this.messages.set(data);
      this.hasEarlierMessages.set(!search && data.length === CHAT_HISTORY_PAGE_SIZE);
      void this.acknowledgeUnreadMessages(data);
      if (this._restoredReplyToId) {
        const target = data.find((m) => m.id === this._restoredReplyToId);
        if (target) this.replyingTo.set(target);
        this._restoredReplyToId = null;
      }
    } catch (error) {
      if (this.roomId !== roomId) return;
      console.error('Failed to load chat history:', error);
      const status = errorStatus(error);
      this.historyError.set(status === 401 || status === 403 ? 'forbidden' : 'unavailable');
    } finally {
      if (this.roomId === roomId) this.isLoading.set(false);
    }
  }

  async loadEarlierMessages(): Promise<void> {
    if (this.isLoadingEarlier()) return;
    const oldest = this.messages().find((message) => message.message_type !== 'system');
    if (!oldest) {
      this.hasEarlierMessages.set(false);
      return;
    }

    const roomId = this.roomId;
    this.isLoadingEarlier.set(true);
    this.loadEarlierError.set(false);
    try {
      const older = await this.chatService.getLatestMessages(roomId, {
        before: oldest.created_at,
        limit: CHAT_HISTORY_PAGE_SIZE,
      });
      if (this.roomId !== roomId) return;
      this.keepReadingPositionAfterRender();
      this.messages.update((current) => prependOlderMessages(current, older));
      this.hasEarlierMessages.set(older.length === CHAT_HISTORY_PAGE_SIZE);
      void this.acknowledgeUnreadMessages(older);
    } catch (error) {
      console.error('Failed to load earlier chat history:', error);
      this.loadEarlierError.set(true);
    } finally {
      if (this.roomId === roomId) this.isLoadingEarlier.set(false);
    }
  }

  private async reconcileAfterReconnect(roomId: string): Promise<void> {
    try {
      const latest = await this.chatService.getLatestMessages(roomId, {
        limit: CHAT_HISTORY_PAGE_SIZE,
      });
      if (this.roomId !== roomId) return;
      this.messages.update((current) =>
        reconcileLatestWindow(current, latest, CHAT_HISTORY_PAGE_SIZE),
      );
      void this.acknowledgeUnreadMessages(latest);
    } catch (error) {
      const status = errorStatus(error);
      if (status === 401 || status === 403) {
        this.historyError.set('forbidden');
      }
    }
  }

  async setupRealTime(): Promise<void> {
    await this.centrifugeService.connect();

    if (this.subscribedRoomId && this.subscribedRoomId !== this.roomId) {
      this.centrifugeService.unsubscribe(`chat:${this.subscribedRoomId}`);
      this.subscribedRoomId = null;
      this.subscription = null;
    }

    if (this.subscribedRoomId !== this.roomId) {
      const subscribedRoomId = this.roomId;
      this.subscription = this.centrifugeService.subscribe(
        `chat:${subscribedRoomId}`,
        (data: unknown) => this.handleRealtimeEvent(data, subscribedRoomId),
      );
      this.subscribedRoomId = subscribedRoomId;
    }

    this.typingService.connect(this.roomId);

    // Already connected: the subscription becomes active within a round trip, so
    // close the gap since the history request now. A connection that is still
    // being established triggers the same catch-up from the effect above.
    if (this.centrifugeService.connectionStatus() === 'connected') {
      void this.reconcileAfterReconnect(this.roomId);
    }
  }

  private handleRealtimeEvent(data: unknown, eventRoomId: string): void {
    // A late callback from a previous subscription must never mutate the newly
    // selected room.
    if (eventRoomId !== this.roomId) return;

    const currentUserId = this.authService.currentUser()?.id;
    const currentMessages = this.messages();
    const result = applyChatRoomRealtimeEvent(currentMessages, data, eventRoomId, currentUserId);

    if (result.messages !== currentMessages) {
      this.messages.set(result.messages);
    }

    if (result.incomingMessageToMarkRead) {
      void this.acknowledgeUnreadMessages([result.incomingMessageToMarkRead]);
    }
  }

  /**
   * A message counts as read once the reader can actually see it: the page is
   * visible and the list is at (or following) the newest message. Anything that
   * arrives while the reader is scrolled away or the tab is hidden is
   * acknowledged later, when they return to it.
   */
  private async acknowledgeUnreadMessages(messages: ChatMessage[]): Promise<void> {
    if (!this.followingLatest || this.document.visibilityState === 'hidden') return;

    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;

    const roomId = this.roomId;
    const messageIds = messages
      .filter(
        (message) =>
          message.message_type !== 'system' &&
          message.sender_id !== currentUserId &&
          message.delivery_status !== 'read' &&
          !message.is_read &&
          !this.pendingReadReceipts.has(message.id) &&
          !this.acknowledgedReadIds.has(message.id),
      )
      .map((message) => message.id);

    if (messageIds.length === 0) return;

    for (const messageId of messageIds) {
      this.pendingReadReceipts.add(messageId);
    }

    try {
      await this.chatService.markRoomRead(roomId, messageIds);
      if (this.roomId === roomId) {
        for (const messageId of messageIds) {
          this.acknowledgedReadIds.add(messageId);
        }
      }
    } catch {
      // Receipt delivery is best-effort. Persisted message history remains usable
      // and a later room load or realtime event can retry the idempotent update.
    } finally {
      for (const messageId of messageIds) {
        this.pendingReadReceipts.delete(messageId);
      }
    }
  }

  onVisibilityChange(): void {
    if (this.document.visibilityState === 'hidden') return;
    void this.acknowledgeUnreadMessages(this.messages());
  }

  onWordClicked(event: { token: string; context: string }): void {
    this.activeWordToken.set(event.token);
    this.activeWordContext.set(event.context);
  }

  onComposerInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.textInput = target.value;
    const cursor = target.selectionStart ?? target.value.length;
    const textBeforeCursor = target.value.slice(0, cursor);
    const match = /@([\wÀ-ɏ؀-ۿ]*)$/.exec(textBeforeCursor);
    if (match) {
      this.mentionRangeStart = match.index;
      this.mentionRangeEnd = cursor;
      this.mentionQuery.set(match[1]);
    } else {
      this.mentionQuery.set(null);
    }
    this.typingService.sendTyping(target.value.length > 0);
    this.saveChatDrafts();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.mentionSuggestions().length === 0) {
      event.preventDefault();
      this.sendTextMessage();
    }
  }

  onMentionSelected(member: unknown): void {
    if (!member) return;
    this.mentionQuery.set(null);
    this.saveChatDrafts();
  }

  async sendTextMessage(): Promise<void> {
    if (!this.textInput.trim() || this.isCheckingGrammar()) return;
    const text = this.textInput.trim();
    const replyToId = this.replyingTo()?.id;
    this.mentionQuery.set(null);
    this.typingService.sendTyping(false);

    this.isCheckingGrammar.set(true);
    try {
      const grammar = await this.vocabStore.checkGrammar(text, this.partnerLanguage() ?? undefined);
      const corrected = grammar.corrected.trim();
      if (grammar.errors_found > 0 && corrected && corrected !== text) {
        this.textInput = corrected;
        this.saveChatDrafts();
        showToast(grammar.explanation);
        return;
      }
    } finally {
      this.isCheckingGrammar.set(false);
    }

    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'text',
        text_content: text,
        reply_to_id: replyToId,
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
      this.replyingTo.set(null);
      this.textInput = '';
      this.clearChatDrafts();
    } catch (e) {
      console.error('Failed to send text message:', e);
      this.draftService.saveChatDraft(this.roomId, text);
      showErrorToast(this.i18n.translate('chatRoom.sendFailed'));
    }
  }

  async sendCorrection(): Promise<void> {
    if (!this.originalText.trim() || !this.correctedText.trim()) return;
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'correction',
        correction_payload: {
          original: this.originalText.trim(),
          corrected: this.correctedText.trim(),
          explanation: this.explanationText.trim() || undefined,
        },
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
      this.originalText = '';
      this.correctedText = '';
      this.explanationText = '';
      this.showCorrectionForm.set(false);
      this.clearChatDrafts();
    } catch (e) {
      console.error('Failed to send correction:', e);
    }
  }

  async requestCorrection(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'correction_request',
        correction_request_payload: { original_text: msg.text_content },
        reply_to_id: msg.id,
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to request correction:', e);
    }
  }

  async onDoodleSaved(dataUrl: string): Promise<void> {
    this.showDoodleModal.set(false);
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'doodle',
        media_url: dataUrl,
        text_content: this.i18n.translate('chatRoom.doodleCaption'),
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to send doodle:', e);
    }
  }

  async onVoiceUploaded(mediaUrl: string): Promise<void> {
    this.showVoiceModal.set(false);
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'voice',
        media_url: mediaUrl,
        text_content: this.i18n.translate('chatRoom.voiceMessage'),
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to send voice note:', e);
    }
  }

  async sendSticker(stickerUrl: string): Promise<void> {
    this.showStickerDrawer.set(false);
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'sticker',
        media_url: stickerUrl,
        text_content: this.i18n.translate('chatRoom.stickerCaption'),
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to send sticker:', e);
    }
  }

  async bookmark(msg: ChatMessage): Promise<void> {
    try {
      await this.chatService.addFavourite(msg.id, this.i18n.translate('chatRoom.favouriteNote'));
      showToast(this.i18n.translate('chatRoom.bookmarkSuccess'));
    } catch (e) {
      console.error('Failed to bookmark message:', e);
      showToast(this.i18n.translate('chatRoom.bookmarkError'));
    }
  }

  startCorrection(msg: ChatMessage): void {
    if (msg.message_type !== 'text') return;
    this.originalText = msg.text_content ?? '';
    this.correctedText = '';
    this.explanationText = '';
    this.showCorrectionForm.set(true);
  }

  onBlockToggle(event: { senderId: string; blocked: boolean }): void {
    if (event.blocked) {
      this.blockedUserIds.update((ids) => [...ids, event.senderId]);
      showToast(this.i18n.translate('safety.blockedAlert'));
    } else {
      this.blockedUserIds.update((ids) => ids.filter((id) => id !== event.senderId));
      showToast(this.i18n.translate('safety.unblockedAlert'));
    }
  }

  async saveSentenceToLingq(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;
    try {
      const trans = await this.vocabStore.translateWordOrSentence(msg.text_content, 'en');
      const created = await this.vocabStore.saveWord({
        word_token: msg.text_content,
        translation:
          trans?.translated_text ||
          this.i18n.translate('chatRoom.sentenceTranslationFallback', {
            text: msg.text_content,
          }),
        original_context: this.i18n.translate('chatRoom.lingqContext'),
        definition: this.i18n.translate('chatRoom.lingqDefinition'),
      });
      await this.vocabStore.updateSrsLevel(created.id, 1);
      showToast(this.i18n.translate('chatRoom.savedLingqAlert', { text: msg.text_content }));
    } catch (e) {
      console.error('Failed to save sentence to LingQ deck:', e);
      showToast(this.i18n.translate('chatRoom.saveLingqError'));
    }
  }

  async transliterateMessage(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;
    try {
      const result = await this.vocabStore.translateWordOrSentence(msg.text_content, 'en');
      this.transliterations.update((prev) => ({
        ...prev,
        [msg.id]: result.transliteration || result.translated_text,
      }));
    } catch (e) {
      console.error('Failed to transliterate message:', e);
      showToast(this.i18n.translate('moments.transError'));
    }
  }

  speakMessage(msg: ChatMessage): void {
    if (!msg.text_content?.trim()) return;
    this.tts.speak(msg.id, msg.text_content);
  }

  async toggleTranslation(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;

    const currentShow = this.showTranslation()[msg.id];
    if (currentShow) {
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: false }));
      return;
    }

    if (this.translations()[msg.id]) {
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
      return;
    }

    const targetLang = this.i18n.currentLang().split('-')[0] || 'en';
    const cached = this.translationCache.get(msg.text_content, targetLang);
    if (cached) {
      this.translations.update((prev) => ({ ...prev, [msg.id]: cached }));
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
      return;
    }

    try {
      const res = await this.chatService.translateText(msg.text_content, targetLang);
      this.translationCache.set(msg.text_content, targetLang, res.translated_text);
      this.translations.update((prev) => ({ ...prev, [msg.id]: res.translated_text }));
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
    } catch (e) {
      console.error('Failed to translate message:', e);
      showToast(this.i18n.translate('moments.transError'));
    }
  }

  async onTranscribeVoice(msg: ChatMessage): Promise<void> {
    if (!msg.media_url || this.transcriptions()[msg.id]) return;
    this.transcribingIds.update((s) => {
      const next = new Set(s);
      next.add(msg.id);
      return next;
    });

    try {
      const result = await this.chatService.transcribeVoice(msg.media_url);
      this.transcriptions.update((prev) => ({
        ...prev,
        [msg.id]: result.original_text || this.i18n.translate('chatRoom.transcriptEmpty'),
      }));
    } catch (e) {
      console.error('Failed to transcribe voice message:', e);
      showToast(this.i18n.translate('chatRoom.transcribeError'));
    } finally {
      this.transcribingIds.update((s) => {
        const next = new Set(s);
        next.delete(msg.id);
        return next;
      });
    }
  }

  onSearch(): void {
    void this.loadMessages();
  }

  onSearchResultSelect(message: ChatMessage): void {
    this.showSearchPanel.set(false);
    if (message.room_id === this.roomId) this.scrollToMessage(message.id);
  }

  async toggleParticipantDrawer(): Promise<void> {
    this.showParticipantDrawer.update((v) => !v);
    if (this.showParticipantDrawer() && this.participants().length === 0) {
      await this.loadParticipants();
    }
  }

  async loadParticipants(): Promise<void> {
    try {
      const members = await this.chatService.getGroupMembers(this.roomId);
      this.participants.set(members);
    } catch (e) {
      console.error('Failed to load participants:', e);
    }
  }

  sendCorrectionFromInput(correction: {
    original: string;
    corrected: string;
    explanation?: string;
  }): void {
    this.originalText = correction.original;
    this.correctedText = correction.corrected;
    this.explanationText = correction.explanation || '';
    this.sendCorrection();
  }

  onMessageListScroll(): void {
    const list = this.messageList()?.nativeElement;
    if (!list) return;
    const distanceFromLatest = list.scrollHeight - list.scrollTop - list.clientHeight;
    const wasFollowing = this.followingLatest;
    this.followingLatest = distanceFromLatest <= FOLLOW_LATEST_THRESHOLD_PX;
    if (!this.followingLatest) return;
    if (this.unseenMessageCount() > 0) this.unseenMessageCount.set(0);
    if (!wasFollowing) void this.acknowledgeUnreadMessages(this.messages());
  }

  jumpToLatest(): void {
    this.unseenMessageCount.set(0);
    this.scrollToLatestAfterRender();
    void this.acknowledgeUnreadMessages(this.messages());
  }

  /**
   * Keeps the reader oriented as the stream changes:
   * - the first page of a room, a retry or a search result starts at the newest message;
   * - new messages scroll into view while the reader is following the conversation
   *   or when they are the reader's own;
   * - otherwise the reading position is left alone and the unseen count grows.
   * Older history, receipt updates and edits add nothing newer than what was
   * already shown, so they never move the list.
   */
  private followMessageStream(shown: ChatMessage[]): void {
    const previousIds = this.shownMessageIds;
    const previousLatestAt = this.latestShownAt;
    this.shownMessageIds = new Set(shown.map((message) => message.id));
    this.latestShownAt = shown.reduce((latest, message) => {
      const createdAt = Date.parse(message.created_at);
      return Number.isNaN(createdAt) ? latest : Math.max(latest, createdAt);
    }, Number.NEGATIVE_INFINITY);

    if (shown.length === 0) {
      this.followingLatest = true;
      this.jumpToLatestOnNextLoad = false;
      this.unseenMessageCount.set(0);
      this.incomingAnnouncement.set('');
      return;
    }

    if (this.jumpToLatestOnNextLoad) {
      this.jumpToLatestOnNextLoad = false;
      this.unseenMessageCount.set(0);
      this.scrollToLatestAfterRender();
      return;
    }

    const arrivals = shown.filter(
      (message) =>
        !previousIds.has(message.id) && !(Date.parse(message.created_at) < previousLatestAt),
    );
    if (arrivals.length === 0) return;

    const currentUserId = this.authService.currentUser()?.id;
    this.announceIncoming(
      arrivals.filter(
        (message) => message.message_type !== 'system' && message.sender_id !== currentUserId,
      ),
    );
    if (this.followingLatest || arrivals.some((message) => message.sender_id === currentUserId)) {
      this.unseenMessageCount.set(0);
      this.scrollToLatestAfterRender();
      return;
    }

    const unseen = arrivals.filter((message) => message.message_type !== 'system').length;
    if (unseen > 0) this.unseenMessageCount.update((count) => count + unseen);
  }

  private announceIncoming(incoming: ChatMessage[]): void {
    if (incoming.length === 0) return;
    if (incoming.length > 1) {
      this.incomingAnnouncement.set(
        this.i18n.translate('chatRoom.newMessages', { count: incoming.length }),
      );
      return;
    }

    const [message] = incoming;
    const name = message.sender?.display_name || this.i18n.translate('chatRoom.partnerFallback');
    const text = message.message_type === 'text' ? (message.text_content ?? '').trim() : '';
    if (!text) {
      this.incomingAnnouncement.set(this.i18n.translate('chatRoom.incomingOtherMessage', { name }));
      return;
    }
    this.incomingAnnouncement.set(
      this.i18n.translate('chatRoom.incomingMessage', { name, text: this.cutForSpeech(text) }),
    );
  }

  /**
   * Cuts at a user-perceived character, not a UTF-16 unit or code point, so an
   * emoji sequence or a letter with combining marks is never split in half.
   */
  private cutForSpeech(text: string): string {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let kept = '';
    let count = 0;
    for (const { segment } of segmenter.segment(text)) {
      if (count === MAX_ANNOUNCED_CHARACTERS) return `${kept}...`;
      kept += segment;
      count += 1;
    }
    return text;
  }

  private scrollToLatestAfterRender(): void {
    this.followingLatest = true;
    afterNextRender(
      {
        write: () => {
          const list = this.messageList()?.nativeElement;
          if (list) list.scrollTop = list.scrollHeight;
        },
      },
      { injector: this.injector },
    );
  }

  /**
   * Older history is inserted above the viewport. Restoring the offset from the
   * height gained keeps the same message under the reader's eyes in every browser.
   */
  private keepReadingPositionAfterRender(): void {
    const list = this.messageList()?.nativeElement;
    if (!list) return;
    const heightBefore = list.scrollHeight;
    const offsetBefore = list.scrollTop;
    afterNextRender(
      {
        write: () => {
          list.scrollTop = offsetBefore + (list.scrollHeight - heightBefore);
        },
      },
      { injector: this.injector },
    );
  }

  scrollToMessage(messageId: string): void {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.highlightedMessageId.set(messageId);
    setTimeout(() => this.highlightedMessageId.set(null), 1500);
  }

  parentMessageFor(msg: ChatMessage): ChatMessage | undefined {
    if (!msg.reply_to_id) return undefined;
    return this.messages().find((m) => m.id === msg.reply_to_id);
  }

  /**
   * What a reply points at. The parent may not be loaded (older history), so this
   * uses the preview sent by the API, then a localised unavailable-message label.
   * `label` is the accessible name of the control that jumps to the parent: it
   * carries the visible sender and text, so speech input can address it by what
   * is on screen.
   */
  replyReference(msg: ChatMessage): { name: string; text: string; label: string } {
    const parent = this.parentMessageFor(msg);
    const name =
      (parent?.sender?.display_name ?? msg.reply_preview?.display_name) ||
      this.i18n.translate('chat.unknown_user');
    const text =
      (parent?.text_content ?? msg.reply_preview?.text_content) ||
      this.i18n.translate('chatRoom.replyPreviewFallback');
    return {
      name,
      text,
      label: this.i18n.translate('chatRoom.jumpToReplied', { name, text: this.cutForSpeech(text) }),
    };
  }

  startReply(messageId: string): void {
    const parent = this.messages().find((m) => m.id === messageId);
    if (parent) this.replyingTo.set(parent);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  openDoodlePreview(url: string): void {
    window.open(url, '_blank');
  }

  async renameGroup(): Promise<void> {
    if (!this.newGroupName.trim()) return;
    try {
      await this.chatService.renameGroup(this.roomId, this.newGroupName.trim());
      this.roomDetails.update((room) =>
        room ? { ...room, title: this.newGroupName.trim() } : null,
      );
      this.newGroupName = '';
      showToast(this.i18n.translate('chatRoom.renameSuccess'));
    } catch (e) {
      console.error('Failed to rename group:', e);
      showErrorToast(this.i18n.translate('chatRoom.renameFailed'));
    }
  }

  async addMember(): Promise<void> {
    if (!this.newMemberId.trim()) return;
    try {
      await this.chatService.addGroupMembers(this.roomId, [this.newMemberId.trim()]);
      this.newMemberId = '';
      showToast(this.i18n.translate('chatRoom.memberAddedSuccess'));
      if (this.showParticipantDrawer()) await this.loadParticipants();
    } catch (e) {
      console.error('Failed to add member:', e);
      showErrorToast(this.i18n.translate('chatRoom.memberAddedFailed'));
    }
  }

  async removeMember(): Promise<void> {
    if (!this.memberToRemoveId.trim()) return;
    try {
      await this.chatService.removeGroupMember(this.roomId, this.memberToRemoveId.trim());
      this.memberToRemoveId = '';
      showToast(this.i18n.translate('chatRoom.memberRemovedSuccess'));
      if (this.showParticipantDrawer()) await this.loadParticipants();
    } catch (e) {
      console.error('Failed to remove member:', e);
      showErrorToast(this.i18n.translate('chatRoom.memberRemovedFailed'));
    }
  }

  async playNextVoiceNote(currentMessageId: string): Promise<void> {
    if (!this.autoPlayVoiceNotes()) return;
    const msgs = this.messages();
    const currentIndex = msgs.findIndex((m) => m.id === currentMessageId);
    if (currentIndex === -1) return;

    for (let i = currentIndex + 1; i < msgs.length; i++) {
      const nextMsg = msgs[i];
      if (nextMsg.message_type === 'voice' && nextMsg.media_url) {
        const audioElement = document.getElementById(`audio-${nextMsg.id}`);
        if (audioElement instanceof HTMLAudioElement) {
          audioElement.play().catch(() => {});
        }
        break;
      }
    }
  }
}
