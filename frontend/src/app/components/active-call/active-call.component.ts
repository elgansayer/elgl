import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  input,
  output,
  inject,
  afterNextRender,
  signal,
  OnDestroy,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { LivekitService } from '../../services/livekit.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-active-call',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './active-call.component.html',
  styleUrls: ['./active-call.component.scss'],
})
export class ActiveCallComponent implements OnDestroy {
  private readonly livekitService = inject(LivekitService);
  private readonly authService = inject(AuthService);

  /** The display name of the person you are calling. */
  readonly callerName = input.required<string>();

  /** URL to the caller's avatar, if any. */
  readonly callerAvatar = input<string>('');

  /** The LiveKit room name for this call. */
  readonly roomName = input.required<string>();

  /** Whether the call is incoming or outgoing. */
  readonly callDirection = input<'incoming' | 'outgoing'>('outgoing');

  /** Whether the local microphone is currently muted. */
  readonly isMuted = input<boolean>(false);

  /** Whether the speakerphone (loudspeaker) is currently active. */
  readonly isSpeakerphone = input<boolean>(false);

  // ------------------------------------------------------------------- //
  //  Internal call state
  // ------------------------------------------------------------------- //

  readonly callState = signal<'idle' | 'connecting' | 'connected' | 'ended'>('idle');

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
  //  Life‑cycle: connect to LiveKit as soon as the DOM is ready
  // ------------------------------------------------------------------- //

  constructor() {
    afterNextRender(() => {
      this.connectCall();
    });
  }

  // ------------------------------------------------------------------- //
  //  Click handlers  (forward event and inform LiveKit)
  // ------------------------------------------------------------------- //

  onToggleMute(): void {
    this.livekitService.toggleMute();
    this.muteToggle.emit();
  }

  onToggleSpeaker(): void {
    this.livekitService.toggleSpeakerphone();
    this.speakerToggle.emit();
  }

  onEndCall(): void {
    this.livekitService.leaveRoom();
    this.callState.set('ended');
    this.endCall.emit();
  }

  // ------------------------------------------------------------------- //
  //  Internal helpers
  // ------------------------------------------------------------------- //

  private async connectCall(): Promise<void> {
    try {
      const userId = this.authService.currentUser()?.id;
      if (!userId) {
        this.callState.set('ended');
        return;
      }

      this.callState.set('connecting');
      await this.livekitService.joinRoom(
        this.roomName(),
        userId,
        false, // not a video call
      );
      await this.livekitService.publishTracks();

      this.callState.set('connected');
    } catch {
      this.callState.set('ended');
    }
  }

  ngOnDestroy(): void {
    this.livekitService.leaveRoom();
  }
}
