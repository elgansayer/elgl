import { Component, inject, resource, signal, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  StudyBuddyService,
  StudyBuddyMatch,
  BuddyRequest,
} from '../../services/study-buddy.service';

@Component({
  selector: 'app-study-buddy',
  imports: [TranslatePipe],
  template: `
    <main class="mx-auto max-w-4xl space-y-6 pb-20 pt-4" role="main" aria-labelledby="study-buddy-title">
      <section class="app-card app-padded space-y-3">
        <h2 id="study-buddy-title" class="app-section-title">{{ 'studyBuddy.title' | t }}</h2>
        <p class="app-muted">{{ 'studyBuddy.description' | t }}</p>
      </section>

      @if (dataResource.isLoading()) {
        <div class="app-card app-padded py-12 text-center" role="status">
          <p class="app-muted">{{ 'common.loading' | t }}</p>
        </div>
      } @else if (dataResource.error()) {
        <div class="app-card app-padded py-12 text-center" role="alert">
          <p class="font-bold text-rose-400">{{ 'common.loadError' | t }}</p>
        </div>
      } @else {
        @if (incomingRequests().length) {
          <section class="app-card app-padded space-y-3" aria-labelledby="incoming-requests-title">
            <h3 id="incoming-requests-title" class="text-sm font-black text-text-primary">
              {{ 'studyBuddy.incomingRequestsTitle' | t }}
            </h3>
            <div role="list">
            @for (req of incomingRequests(); track req.id) {
              <div
                role="listitem"
                class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-100 bg-surface-300 px-3 py-3"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    [src]="req.requester?.avatar_url || ''"
                    [alt]="'studyBuddy.avatarAlt' | t: { name: req.requester?.display_name || ('studyBuddy.requesterFallback' | t) }"
                    class="w-10 h-10 rounded-full object-cover bg-surface-100 flex-shrink-0"
                    loading="lazy"
                  />
                  <span class="text-sm font-bold text-text-primary truncate">{{
                    req.requester?.display_name || ('studyBuddy.requesterFallback' | t)
                  }}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    (click)="accept(req.id)"
                    [attr.aria-label]="'studyBuddy.acceptAria' | t: { name: req.requester?.display_name || ('studyBuddy.requesterFallback' | t) }"
                    class="app-button-primary ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {{ 'studyBuddy.acceptBtn' | t }}
                  </button>
                  <button
                    type="button"
                    (click)="decline(req.id)"
                    [attr.aria-label]="'studyBuddy.declineAria' | t: { name: req.requester?.display_name || ('studyBuddy.requesterFallback' | t) }"
                    class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  >
                    {{ 'studyBuddy.declineBtn' | t }}
                  </button>
                </div>
              </div>
            }
            </div>
          </section>
        }

        <section class="app-card app-padded space-y-3" aria-labelledby="potential-matches-title">
          <h3 id="potential-matches-title" class="text-sm font-black text-text-primary">
            {{ 'studyBuddy.potentialMatches' | t }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" role="list">
            @for (user of matches(); track user.id) {
              <div
                role="listitem"
                class="flex flex-col items-center gap-2 rounded-card border border-surface-100 bg-surface-300 p-4 text-center"
              >
                <img
                  [src]="user.avatar_url || ''"
                  [alt]="'studyBuddy.avatarAlt' | t: { name: user.display_name }"
                  class="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover bg-surface-100"
                  loading="lazy"
                />
                <span class="text-sm font-bold text-text-primary truncate w-full">{{ user.display_name }}</span>
                <button
                  type="button"
                  [disabled]="requestedIds().has(user.id)"
                  (click)="requestBuddy(user.id)"
                  [attr.aria-label]="'studyBuddy.requestAria' | t: { name: user.display_name }"
                  class="app-button-primary w-full ps-3 pe-3 pt-2 pb-2 text-xs font-bold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {{
                    requestedIds().has(user.id)
                      ? ('studyBuddy.requestSentBtn' | t)
                      : ('studyBuddy.requestBtn' | t)
                  }}
                </button>
              </div>
            } @empty {
              <div class="col-span-full app-empty-state py-8">
                <p class="text-xs text-text-secondary">{{ 'studyBuddy.matchesEmpty' | t }}</p>
              </div>
            }
          </div>
        </section>
      }
    </main>
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
