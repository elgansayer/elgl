import { HlmButton } from '@spartan-ng/helm/button';
import { Component, ChangeDetectionStrategy, input, computed, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly hasCoHostOverride = input<boolean | undefined>(undefined);

  readonly hasCoHost = computed(() => {
    const override = this.hasCoHostOverride();
    return override !== undefined ? override : !!this.coHostVideoUrl();
  });

  readonly invite = output<void>();
  readonly retry = output<void>();

  onInviteClick(): void {
    this.invite.emit();
  }

  onRetryClick(): void {
    this.retry.emit();
  }
}
