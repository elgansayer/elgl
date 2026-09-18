import { HlmButton } from '@spartan-ng/helm/button';
import { showToast } from '../../services/toast.service';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { ConfirmService } from '../../services/confirm.service';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AudioRoomArchivesService } from '../../services/audio-room-archives.service';
import { AuthService } from '../../services/auth.service';
import { QuickPollService } from '../../services/quick-poll.service';
import { RoomChatComponent } from '../room-chat/room-chat.component';
import { VoiceroomNotesComponent } from '../voiceroom-notes/voiceroom-notes.component';
import { VideoRoomComponent } from '../video-room/video-room.component';
import { AudioEqualizerComponent } from '../primitives/audio-equalizer/audio-equalizer.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { VirtualGiftModalComponent } from '../virtual-gift-modal/virtual-gift-modal.component';
import { TrustSafetyModalComponent } from '../trust-safety-modal/trust-safety-modal.component';
import {
  VoiceroomCreateModalComponent,
  VoiceroomCreatePayload,
} from '../voiceroom-create-modal/voiceroom-create-modal.component';
import { PrivatePartyCreatePayload } from '../private-party-create-modal/private-party-create-modal.component';
import { QuickPollFormComponent } from './quick-poll-form.component';
import { QuickPollDisplayComponent } from './quick-poll-display.component';
import { ApproveSpeakerModalComponent } from './approve-speaker-modal.component';
import { LiveChatOverlayComponent } from '../live-chat-overlay/live-chat-overlay.component';
import { TipHostModalComponent } from '../tip-host-modal/tip-host-modal.component';
import { VideoClassroomErrorBoundaryComponent } from '../video-classroom-error-boundary/video-classroom-error-boundary.component';
import {
  buildAudienceSeatIndexes,
  buildStageViewModel,
  normaliseAudienceCount,
} from './audio-room-view-model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-audio-room',
  imports: [
    HlmButton,
    TranslatePipe,
    RoomChatComponent,
    VoiceroomNotesComponent,
    VideoRoomComponent,
    VideoClassroomErrorBoundaryComponent,
    VirtualGiftModalComponent,
    TrustSafetyModalComponent,
    VoiceroomCreateModalComponent,

    ApproveSpeakerModalComponent,
    AudioEqualizerComponent,
    AppCardComponent,
    AppChipComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
    QuickPollFormComponent,
    QuickPollDisplayComponent,
    LiveChatOverlayComponent,
    TipHostModalComponent,
  ],
  templateUrl: './audio-room.component.html',
  styleUrls: ['./audio-room.component.scss'],
})
export class AudioRoomComponent implements OnInit {
  readonly store = inject(AudioRoomsStore);
  readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly confirmService = inject(ConfirmService);
  private readonly archiveService = inject(AudioRoomArchivesService);
  private readonly apiBase = environment.apiUrl;

  readonly showCreateModal = signal<boolean>(false);
  readonly isCreatingRoom = signal<boolean>(false);
  readonly showPrivatePartyModal = signal<boolean>(false);
  readonly showGiftModal = signal<boolean>(false);
  readonly showTipModal = signal<boolean>(false);
  readonly showSafetyModal = signal<boolean>(false);
  readonly showApprovalModal = signal<boolean>(false);
  readonly showPollFormModal = signal<boolean>(false);
  readonly showPollResultsModal = signal<boolean>(false);
  readonly showNotesPanel = signal<boolean>(false);
  readonly currentPollId = signal<string | null>(null);
  readonly sidebarTab = signal<'chat' | 'notes'>('chat');

  readonly stageViewModel = computed(() =>
    buildStageViewModel(
      this.store.currentRoom(),
      this.store.stageInfo(),
      this.store.stageParticipants(),
    ),
  );
  readonly stageParticipants = computed(() => this.stageViewModel().participants);
  readonly stageOverflowCount = computed(() => this.stageViewModel().overflowCount);
  readonly audienceCount = computed(() => {
    const count = this.store.stageInfo()
      ? this.store.audienceCount()
      : (this.store.currentRoom()?.listeners_count ?? this.store.audienceCount());
    return normaliseAudienceCount(count);
  });
  readonly audiencePlaceholderAvatars = computed(() =>
    buildAudienceSeatIndexes(this.audienceCount()),
  );
  readonly audienceOverflowCount = computed(() =>
    Math.max(0, this.audienceCount() - this.audiencePlaceholderAvatars().length),
  );
  readonly pollResults = signal<{
    question: string;
    options: string[];
    votes: number[];
    totalVotes: number;
  } | null>(null);

  readonly httpClient = inject(HttpClient);

  readonly exclusiveEmojis = signal<{ emojiId: string; name: string; animationUrl: string }[]>([]);
  readonly showExclusivePicker = signal<boolean>(false);

  /** Toggle between flat list view and language-grouped view */
  readonly viewMode = signal<'flat' | 'grouped'>('grouped');

  /** Rooms currently displayed (either all, or filtered by selected language group) */
  readonly displayedRooms = computed(() => {
    const selected = this.store.selectedLanguageGroup();
    if (selected) {
      const group = this.store.roomsByLanguage().find((g) => g.language_pair === selected);
      return group?.rooms ?? [];
    }
    return this.store.activeRooms();
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.store.loadActiveRooms(),
      this.store.loadRoomsByLanguage(),
      this.store.loadPrivateRooms(),
    ]);
    try {
      const result = await firstValueFrom(
        this.httpClient.get<{ emojiId: string; name: string; animationUrl: string }[]>(
          `${this.apiBase}/audio-rooms/exclusive-emojis`,
        ),
      );
      this.exclusiveEmojis.set(result);
    } catch {
      // non-critical, picker will be empty
    }
  }

  selectLanguageGroup(pair: string): void {
    if (this.store.selectedLanguageGroup() === pair) {
      this.store.selectedLanguageGroup.set(null);
    } else {
      this.store.selectedLanguageGroup.set(pair);
    }
  }

  toggleViewMode(): void {
    this.viewMode.update((m) => (m === 'flat' ? 'grouped' : 'flat'));
    this.store.selectedLanguageGroup.set(null);
  }

  selectExclusiveEmoji(emojiId: string): void {
    this.sendExclusiveReaction(emojiId);
    this.showExclusivePicker.set(false);
  }

  async createRoom(payload: VoiceroomCreatePayload): Promise<void> {
    if (this.isCreatingRoom()) return;

    this.isCreatingRoom.set(true);
    try {
      const room = await this.store.createRoom(
        payload.title,
        payload.languagePair,
        payload.topicTag,
        payload.isVideoStream,
      );
      this.showCreateModal.set(false);
      await this.store.joinRoom(room);
    } catch (e) {
      console.error('Error creating live room:', e);
      showToast(this.i18n.translate('audioRoom.launchError'));
    } finally {
      this.isCreatingRoom.set(false);
    }
  }

  async createPrivateParty(payload: PrivatePartyCreatePayload): Promise<void> {
    try {
      const room = await this.store.createPrivateParty({
        title: payload.title,
        languagePair: payload.languagePair,
        topicTag: payload.topicTag,
        isVideoStream: payload.isVideoStream,
        invitedUserIds: payload.invitedUserIds,
      });
      this.showPrivatePartyModal.set(false);
      await this.store.joinRoom(room);
    } catch (e) {
      console.error('Error creating private party:', e);
      showToast(this.i18n.translate('privateParty.createError'));
    }
  }

  async join(room: AudioRoomRecord): Promise<void> {
    await this.store.joinRoom(room);
  }

  leave(): void {
    this.store.leaveRoom();
  }

  async raiseHand(): Promise<void> {
    await this.store.raiseHand();
  }

  async approve(targetUserId: string): Promise<void> {
    await this.store.approveSpeaker(targetUserId);
  }

  async handleApproveSpeaker(targetUserId: string): Promise<void> {
    await this.approve(targetUserId);
    this.showApprovalModal.set(false);
  }

  async demote(targetUserId: string): Promise<void> {
    await this.store.demoteSpeaker(targetUserId);
  }

  async mute(targetUserId: string): Promise<void> {
    await this.store.muteSpeaker(targetUserId);
  }

  async kick(targetUserId: string): Promise<void> {
    await this.store.kickSpeaker(targetUserId);
  }

  async archive(): Promise<void> {
    const room = this.store.currentRoom();
    if (!room) return;
    const confirmed = await this.confirmService.confirm(
      this.i18n.translate('audioRoom.archiveConfirm'),
    );
    if (!confirmed) return;

    try {
      await this.archiveService.finalize(room.id);
      this.store.leaveRoom();
    } catch (error) {
      console.error('Archive room error:', error);
      showToast(this.i18n.translate('common.error_generic'));
    }
  }

  readonly quickPollService = inject(QuickPollService);

  async openPollForm(): Promise<void> {
    this.showPollFormModal.set(true);
  }

  async closePollForm(): Promise<void> {
    this.showPollFormModal.set(false);
  }

  async submitPollForm(question: string, options: string[]): Promise<void> {
    const roomId = this.store.currentRoom()?.id;
    if (!roomId) return;
    try {
      const result = await this.quickPollService.createPoll(roomId, question, options);
      this.currentPollId.set(result.poll_id);
      this.showPollFormModal.set(false);
    } catch {
      showToast(this.i18n.translate('common.error'));
    }
  }

  async sendExclusiveReaction(emojiId: string): Promise<void> {
    const room = this.store.currentRoom();
    if (!room) return;
    try {
      await firstValueFrom(
        this.httpClient.post(`${this.apiBase}/audio-rooms/${room.id}/reactions`, { emojiId }),
      );
      showToast(this.i18n.translate('audioRoom.reactionSent'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.i18n.translate('common.error');
      showToast(msg);
    }
  }

  async viewPollResults(pollId: string): Promise<void> {
    const roomId = this.store.currentRoom()?.id;
    if (!roomId) return;
    try {
      const results = await this.quickPollService.getPollResults(roomId, pollId);
      this.pollResults.set(results);
      this.currentPollId.set(pollId);
      this.showPollResultsModal.set(true);
    } catch {
      showToast(this.i18n.translate('common.error'));
    }
  }

  async voteInPoll(pollId: string, optionIndex: number): Promise<void> {
    try {
      await this.quickPollService.submitVote(pollId, optionIndex);
      showToast(this.i18n.translate('quickPoll.yourVote'));
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message === 'You have already voted on this poll'
          ? this.i18n.translate('quickPoll.alreadyVoted')
          : this.i18n.translate('common.error');
      showToast(msg);
    }
  }
}
