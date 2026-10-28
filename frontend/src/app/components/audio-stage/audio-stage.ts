import { Component, computed, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { StageParticipant } from '../../services/audio-rooms.store';

@Component({
  selector: 'app-audio-stage',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './audio-stage.html',
  styleUrl: './audio-stage.scss',
})
export class AudioStage {
  readonly participants = input<StageParticipant[]>([]);
  readonly maxSeats = input<number>(4);
  readonly currentUserId = input<string | null>(null);
  readonly isHost = input<boolean>(false);
  readonly canRaiseHand = input<boolean>(true);
  readonly isHandRaised = input<boolean>(false);

  readonly raiseHand = output<void>();
  readonly lowerHand = output<void>();
  readonly toggleMute = output<void>();
  readonly muteParticipant = output<string>();
  readonly demoteParticipant = output<string>();

  readonly openSeatsCount = computed(() => {
    return Math.max(0, this.maxSeats() - this.participants().length);
  });

  readonly openSeatsArray = computed(() => {
    return Array.from({ length: this.openSeatsCount() }, (_, i) => i);
  });

  readonly isCurrentUserOnStage = computed(() => {
    const uid = this.currentUserId();
    if (!uid) return false;
    return this.participants().some((p) => p.user_id === uid);
  });

  readonly currentUserParticipant = computed(() => {
    const uid = this.currentUserId();
    if (!uid) return null;
    return this.participants().find((p) => p.user_id === uid) ?? null;
  });

  onOpenSeatClick(): void {
    if (this.isCurrentUserOnStage() || !this.canRaiseHand()) {
      return;
    }
    if (this.isHandRaised()) {
      this.lowerHand.emit();
    } else {
      this.raiseHand.emit();
    }
  }

  onToggleMute(): void {
    this.toggleMute.emit();
  }

  onMuteParticipant(userId: string): void {
    this.muteParticipant.emit(userId);
  }

  onDemoteParticipant(userId: string): void {
    this.demoteParticipant.emit(userId);
  }
}
