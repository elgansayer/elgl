import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, input, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface DiscoverableGroup {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  member_count: number;
  is_member: boolean;
  interest_id?: string;
  created_at: string;
}

interface InterestTopic {
  id: string | null;
  tag: string;
  name: string;
}

@Component({
  selector: 'app-groups-discovery',
  imports: [HlmButton, CommonModule, RouterLink, TranslatePipe, SanitiseHtmlPipe],
  template: `
    <div class="flex flex-col h-full">
      <!-- Topic filter pills -->
      @if (interestPills().length > 0) {
        <div
          class="flex overflow-x-auto hide-scrollbar gap-2 px-4 py-2 bg-surface-500 border-b border-surface-200 shrink-0"
          role="radiogroup"
          [attr.aria-label]="'groups_discovery_filter_topics' | t"
        >
          <button
            hlmBtn
            (click)="selectedInterest.set(null)"
            class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 shrink-0"
            [class.bg-accent-500]="selectedInterest() === null"
            [class.text-on-fill]="selectedInterest() === null"
            [class.bg-surface-300]="selectedInterest() !== null"
            [class.text-text-secondary]="selectedInterest() !== null"
            [class.border]="selectedInterest() !== null"
            [class.border-surface-200]="selectedInterest() !== null"
            role="radio"
            [attr.aria-checked]="selectedInterest() === null"
          >
            {{ 'groups_discovery_all_topics' | t }}
          </button>
          @for (topic of interestPills(); track topic.id ?? topic.tag) {
            <button
              hlmBtn
              (click)="selectedInterest.set(topic.id)"
              class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 shrink-0"
              [class.bg-accent-500]="selectedInterest() === topic.id"
              [class.text-on-fill]="selectedInterest() === topic.id"
              [class.bg-surface-300]="selectedInterest() !== topic.id"
              [class.text-text-secondary]="selectedInterest() !== topic.id"
              [class.border]="selectedInterest() !== topic.id"
              [class.border-surface-200]="selectedInterest() !== topic.id"
              role="radio"
              [attr.aria-checked]="selectedInterest() === topic.id"
              [attr.aria-label]="topic.name"
            >
              {{ topic.name }}
            </button>
          }
        </div>
      }

      <!-- Error banner -->
      @if (error()) {
        <div
          class="bg-danger/10 text-danger px-3 py-2 mx-4 mt-3 rounded-lg text-sm shrink-0"
          role="alert"
        >
          {{ error() }}
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex-1 flex items-center justify-center text-text-secondary" aria-busy="true">
          {{ 'loading' | t }}
        </div>
      }

      <!-- Empty state -->
      @if (!loading() && filteredGroups().length === 0) {
        <div
          class="flex-1 flex flex-col items-center justify-center text-text-secondary py-12 px-4"
        >
          <span class="text-4xl mb-3">👥</span>
          <p class="text-sm">{{ 'groups_discovery_empty' | t }}</p>
          @if (selectedInterest()) {
            <button
              hlmBtn
              (click)="selectedInterest.set(null)"
              class="mt-3 text-accent-400 text-sm font-semibold"
            >
              {{ 'groups_discovery_clear_filter' | t }}
            </button>
          }
          @if (!isEmbedded()) {
            <a
              [routerLink]="['/groups/create']"
              class="mt-3 bg-accent-500 hover:bg-accent-400 text-on-fill px-4 py-1.5 rounded-full text-sm font-bold transition-colors"
            >
              {{ 'groups_discovery_create' | t }}
            </a>
          }
        </div>
      }

      <!-- Group cards grid -->
      @if (!loading() && filteredGroups().length > 0) {
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (group of filteredGroups(); track group.id) {
              <div
                class="bg-surface-400 p-3 sm:p-4 rounded-xl border border-surface-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-accent-500/30"
              >
                <div class="min-w-0">
                  <span class="text-text-primary font-semibold text-sm sm:text-base block truncate">
                    {{ group.name | sanitiseHtml }}
                  </span>
                  <span class="text-text-secondary text-xs sm:text-sm">
                    {{ group.member_count }} / {{ group.max_members }}
                    {{ 'groups_discovery_members' | t }}
                  </span>
                </div>
                <div class="shrink-0">
                  @if (!group.is_member && group.member_count < group.max_members) {
                    <button
                      hlmBtn
                      (click)="joinGroup(group.id)"
                      class="bg-accent-500 hover:bg-accent-400 text-on-fill px-4 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      [disabled]="joiningId() === group.id"
                    >
                      {{
                        joiningId() === group.id ? ('loading' | t) : ('groups_discovery_join' | t)
                      }}
                    </button>
                  } @else if (group.is_member) {
                    <span
                      class="inline-flex items-center gap-1 text-accent-400 text-sm font-bold"
                      [attr.aria-label]="'groups_discovery_joined' | t"
                    >
                      <span aria-hidden="true">&#x2713;</span>
                      {{ 'groups_discovery_joined' | t }}
                    </span>
                  } @else {
                    <span class="text-text-muted text-sm">{{ 'groups_discovery_full' | t }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Create group FAB for embedded mode -->
      @if (isEmbedded()) {
        <a
          [routerLink]="['/groups/create']"
          class="fixed bottom-20 end-4 bg-accent-500 hover:bg-accent-400 text-on-fill w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg shadow-accent-500/30 transition-colors z-10"
          [attr.aria-label]="'groups_discovery_create' | t"
        >
          <span aria-hidden="true">+</span>
        </a>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background-color: rgb(var(--surface-500-rgb));
        min-height: 100%;
      }
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `,
  ],
})
export class GroupsDiscoveryComponent {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private apiUrl = environment.apiUrl;

  /** When embedded as a tab, simplifies the layout and omits the page title */
  readonly isEmbedded = input(false);

  protected readonly selectedInterest = signal<string | null>(null);
  protected error = signal('');
  protected joiningId = signal<string | null>(null);

  /** Load interest topics for filter pills */
  protected interestsResource = resource({
    loader: async (): Promise<InterestTopic[]> => {
      try {
        const lang = this.i18n.currentLang();
        return await firstValueFrom(
          this.http.get<InterestTopic[]>(
            `${this.apiUrl}/interests?language=${lang}&includeEmpty=true`,
          ),
        );
      } catch {
        return [];
      }
    },
  });

  protected interestPills = computed(() => {
    const interests = this.interestsResource.value();
    return (interests ?? []).filter((interest): interest is InterestTopic & { id: string } =>
      Boolean(interest.id),
    );
  });

  /** Load discoverable groups from the API */
  protected groupsResource = resource({
    loader: async (): Promise<DiscoverableGroup[]> => {
      this.error.set('');
      try {
        return await firstValueFrom(
          this.http.get<DiscoverableGroup[]>(`${this.apiUrl}/groups/discoverable`),
        );
      } catch {
        this.error.set('Failed to load groups');
        return [];
      }
    },
  });

  protected readonly loading = this.groupsResource.isLoading;
  protected readonly items = this.groupsResource.value;

  /** Filter groups by selected interest */
  protected filteredGroups = computed(() => {
    const groups = this.items();
    const interestId = this.selectedInterest();
    if (!groups) return [];
    if (!interestId) return groups;
    return groups.filter((g) => g.interest_id === interestId);
  });

  async joinGroup(groupId: string): Promise<void> {
    this.joiningId.set(groupId);
    try {
      await firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/groups/${groupId}/join`, {}));
      this.groupsResource.reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to join';
      this.error.set(message);
    } finally {
      this.joiningId.set(null);
    }
  }
}
