import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, resource, signal, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  StudyBuddyService,
  StudyBuddyMatch,
  BuddyRequest,
} from '../../services/study-buddy.service';

@Component({
  selector: 'app-study-buddy',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="p-4">
      <h2 class="text-xl font-bold text-text-primary">{{ 'studyBuddy.title' | t }}</h2>
      <p class="text-text-secondary">{{ 'studyBuddy.description' | t }}</p>

      @if (dataResource.isLoading()) {
        <p class="mt-4 text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (dataResource.error()) {
        <p class="mt-4 text-danger">{{ 'common.loadError' | t }}</p>
      } @else {
        @if (incomingRequests().length) {
          <div class="mt-6">
            <h3 class="font-semibold mb-2 text-text-primary">
              {{ 'studyBuddy.incomingRequestsTitle' | t }}
            </h3>
            @for (req of incomingRequests(); track req.id) {
              <div
                class="flex items-center justify-between gap-3 p-2 bg-surface-200 rounded-lg mb-2"
              >
                <div class="flex items-center gap-3">
                  <img
                    [src]="req.requester?.avatar_url || ''"
                    alt=""
                    class="w-10 h-10 rounded-full object-cover bg-surface-100"
                    loading="lazy"
                  />
                  <span class="text-text-primary">{{
                    req.requester?.display_name || ('studyBuddy.requesterFallback' | t)
                  }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    hlmBtn
                    type="button"
                    (click)="accept(req.id)"
                    class="px-3 py-1 text-sm bg-primary text-on-fill rounded-md"
                  >
                    {{ 'studyBuddy.acceptBtn' | t }}
                  </button>
                  <button
                    hlmBtn
                    type="button"
                    (click)="decline(req.id)"
                    class="px-3 py-1 text-sm text-danger hover:text-danger/80"
                  >
                    {{ 'studyBuddy.declineBtn' | t }}
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <div class="mt-6">
          <h3 class="font-semibold mb-2 text-text-primary">
            {{ 'studyBuddy.potentialMatches' | t }}
          </h3>
          @for (user of matches(); track user.id) {
            <div class="flex items-center justify-between gap-3 p-2 bg-surface-200 rounded-lg mb-2">
              <div class="flex items-center gap-3">
                <img
                  [src]="user.avatar_url || ''"
                  alt=""
                  class="w-10 h-10 rounded-full object-cover bg-surface-100"
                  loading="lazy"
                />
                <span class="text-text-primary">{{ user.display_name }}</span>
              </div>
              <button
                hlmBtn
                type="button"
                [disabled]="requestedIds().has(user.id)"
                (click)="requestBuddy(user.id)"
                class="px-3 py-1 text-sm bg-primary text-on-fill rounded-md disabled:opacity-50"
              >
                {{
                  requestedIds().has(user.id)
                    ? ('studyBuddy.requestSentBtn' | t)
                    : ('studyBuddy.requestBtn' | t)
                }}
              </button>
            </div>
          } @empty {
            <p class="text-text-secondary">{{ 'studyBuddy.matchesEmpty' | t }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class StudyBuddyComponent {
  private sbService = inject(StudyBuddyService);

  readonly requestedIds = signal<Set<string>>(new Set());

  protected dataResource = resource({
    loader: async (): Promise<{ matches: StudyBuddyMatch[]; requests: BuddyRequest[] }> => {
      const [matches, requests] = await Promise.all([
        this.sbService.getMatches(),
        this.sbService.getIncomingRequests(),
      ]);
      return { matches, requests };
    },
  });

  readonly matches = computed(() => this.dataResource.value()?.matches ?? []);
  readonly incomingRequests = computed(() => this.dataResource.value()?.requests ?? []);

  async requestBuddy(partnerId: string): Promise<void> {
    await this.sbService.requestBuddy({ partnerId });
    this.requestedIds.update((ids) => new Set(ids).add(partnerId));
  }

  async accept(requestId: string): Promise<void> {
    await this.sbService.acceptRequest(requestId);
    this.dataResource.reload();
  }

  async decline(requestId: string): Promise<void> {
    await this.sbService.declineRequest(requestId);
    this.dataResource.reload();
  }
}
