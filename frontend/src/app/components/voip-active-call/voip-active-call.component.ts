import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-voip-active-call',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './voip-active-call.component.html',
  styleUrl: './voip-active-call.component.scss',
})
export class VoipActiveCallComponent {
  readonly avatarUrl = input.required<string>();
  readonly callerName = input.required<string>();
  readonly callDurationSeconds = input<number>(0);

  readonly muteChange = output<boolean>();
  readonly speakerChange = output<boolean>();
  readonly endCall = output<void>();

  readonly isMuted = signal(false);
  readonly isSpeakerOn = signal(false);

  toggleMute(): void {
    const newVal = !this.isMuted();
    this.isMuted.set(newVal);
    this.muteChange.emit(newVal);
  }

  toggleSpeaker(): void {
    const newVal = !this.isSpeakerOn();
    this.isSpeakerOn.set(newVal);
    this.speakerChange.emit(newVal);
  }

  formattedDuration(): string {
    const totalSec = this.callDurationSeconds();
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    const parts: string[] = [];
    if (hh > 0) {
      parts.push(String(hh).padStart(2, '0'));
    }
    parts.push(String(mm).padStart(2, '0'));
    parts.push(String(ss).padStart(2, '0'));
    return parts.join(':');
  }
}
