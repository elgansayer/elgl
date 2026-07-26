import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-video-room-layout',
  standalone: true,
  imports: [CommonModule, AppButtonSecondaryComponent],
  templateUrl: './video-room-layout.component.html',
  styleUrls: ['./video-room-layout.component.scss']
})
export class VideoRoomLayoutComponent {
  // In a real LiveKit implementation, these would be VideoTrack or Participant objects
  readonly hostStreamUrl = input<string | null>(null);
  readonly coHostStreamUrl = input<string | null>(null);
  readonly isCurrentUserHost = input<boolean>(false);

  readonly inviteCoHostClicked = output<void>();

  readonly isSplitScreen = computed(() => {
    return !!this.hostStreamUrl() && !!this.coHostStreamUrl();
  });

  onInviteCoHost(): void {
    this.inviteCoHostClicked.emit();
  }
}
