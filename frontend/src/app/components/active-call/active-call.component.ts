import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-active-call',
  imports: [TranslatePipe],
  templateUrl: './active-call.component.html',
  styleUrls: ['./active-call.component.scss'],
})
export class ActiveCallComponent {
  /** The display name of the person you are calling. */
  readonly callerName = input.required<string>();

  /** URL to the caller's avatar, if any. */
  readonly callerAvatar = input<string>('');

  /** Whether the local microphone is currently muted. */
  readonly isMuted = input<boolean>(false);

  /** Whether the speakerphone (loudspeaker) is currently active. */
  readonly isSpeakerphone = input<boolean>(false);

  // ------------------------------------------------------------------- //
  //  Events emitted to the parent so it can act on them (e.g., call
  //  LiveKit API or Centrifugo signalling).
  // ------------------------------------------------------------------- //

  /** Emitted when the user taps the mute/unmute button. */
  readonly muteToggle = output<void>();

  /** Emitted when the user taps the speakerphone button. */
  readonly speakerToggle = output<void>();

  /** Emitted when the user taps the end‑call button. */
  readonly endCall = output<void>();

  // ------------------------------------------------------------------- //
  //  Click handlers  (simply forward the event to the parent)
  // ------------------------------------------------------------------- //

  onToggleMute(): void {
    this.muteToggle.emit();
  }

  onToggleSpeaker(): void {
    this.speakerToggle.emit();
  }

  onEndCall(): void {
    this.endCall.emit();
  }
}
