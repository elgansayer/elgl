import { Component, input, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-split-screen-video',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './split-screen-video.component.html',
})
export class SplitScreenVideoComponent {
  readonly hostVideoUrl = input<string>('');
  readonly coHostVideoUrl = input<string>('');
  readonly hostName = input<string>('Host');
  readonly coHostName = input<string>('Co-Host');

  readonly hasCoHost = computed(() => !!this.coHostVideoUrl());

  readonly invite = output<void>();

  onInviteClick(): void {
    this.invite.emit();
  }
}
