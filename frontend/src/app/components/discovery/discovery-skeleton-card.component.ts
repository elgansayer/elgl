import { Component, input, computed } from '@angular/core';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-discovery-skeleton-card',
  imports: [AppSkeletonLoaderComponent],
  template: `
    <article
      class="flex items-center justify-between gap-3 p-4 bg-surface-500 skeleton-stagger"
      [style.animation-delay]="staggerDelay()"
      aria-hidden="true"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Avatar skeleton -->
        <app-skeleton-loader
          variant="circle"
          height="56px"
          width="56px"
        />

        <div class="min-w-0 flex-1 flex flex-col gap-2">
          <!-- Name bar -->
          <app-skeleton-loader
            height="14px"
            width="120px"
            borderRadius="4px"
          />

          <!-- Fluency indicator bars -->
          <div class="flex gap-1">
            <app-skeleton-loader
              variant="text"
              height="8px"
              width="60px"
              borderRadius="4px"
            />
            <app-skeleton-loader
              variant="text"
              height="8px"
              width="40px"
              borderRadius="4px"
            />
          </div>

          <!-- Bio text skeleton -->
          <app-skeleton-loader
            variant="text"
            height="10px"
            width="180px"
            borderRadius="4px"
          />

          <!-- Status + distance -->
          <div class="flex gap-2">
            <app-skeleton-loader
              variant="text"
              height="8px"
              width="50px"
              borderRadius="4px"
            />
            <app-skeleton-loader
              variant="text"
              height="8px"
              width="60px"
              borderRadius="4px"
            />
          </div>

          <!-- Interest tag skeletons -->
          <div class="flex gap-1">
            <app-skeleton-loader
              variant="text"
              height="16px"
              width="48px"
              borderRadius="20px"
            />
            <app-skeleton-loader
              variant="text"
              height="16px"
              width="56px"
              borderRadius="20px"
            />
            <app-skeleton-loader
              variant="text"
              height="16px"
              width="42px"
              borderRadius="20px"
            />
          </div>
        </div>
      </div>

      <!-- Action button skeleton -->
      <app-skeleton-loader
        variant="circle"
        height="40px"
        width="40px"
      />
    </article>
  `,
})
export class DiscoverySkeletonCardComponent {
  readonly index = input<number>(0);

  readonly staggerDelay = computed(() => {
    return `${Math.min(this.index() * 60, 300)}ms`;
  });
}