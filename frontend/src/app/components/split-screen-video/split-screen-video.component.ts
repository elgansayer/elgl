import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, computed, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-split-screen-video',
  imports: [HlmButton, TranslatePipe, AppSkeletonLoaderComponent, AppEmptyStateComponent],
  templateUrl: './split-screen-video.component.html',
})
export class SplitScreenVideoComponent {
  readonly hostVideoUrl = input<string>('');
  readonly coHostVideoUrl = input<string>('');
  readonly hostName = input<string>('Host');
  readonly coHostName = input<string>('Co-Host');
  readonly isLoading = input(false);
  readonly hasError = input(false);

  readonly hasCoHost = computed(() => !!this.coHostVideoUrl());

  readonly invite = output<void>();
  readonly retry = output<void>();

  onInviteClick(): void {
    this.invite.emit();
  }

  onRetryClick(): void {
    this.retry.emit();
  }
}
