import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface DiscoverableGroup {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  member_count: number;
  is_member: boolean;
  interest_id: string | null;
  created_at: string;
}

interface InterestTopic {
  id: string;
  name: string;
}

const MAX_DISCOVERABLE_GROUPS = 100;
const MAX_INTEREST_TOPICS = 100;
const MAX_GROUP_NAME_LENGTH = 200;
const MAX_TOPIC_NAME_LENGTH = 100;
const MAX_IDENTIFIER_LENGTH = 128;

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function parseInterestTopics(value: unknown): InterestTopic[] {
  if (!Array.isArray(value) || value.length > MAX_INTEREST_TOPICS) {
    throw new Error('Invalid interest response');
  }

  const seenIds = new Set<string>();
  return value.map((candidate) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !isBoundedString(Reflect.get(candidate, 'id'), MAX_IDENTIFIER_LENGTH) ||
      !isBoundedString(Reflect.get(candidate, 'name'), MAX_TOPIC_NAME_LENGTH)
    ) {
      throw new Error('Invalid interest response');
    }

    const id = String(Reflect.get(candidate, 'id'));
    if (seenIds.has(id)) {
      throw new Error('Duplicate interest response');
    }
    seenIds.add(id);

    return {
      id,
      name: String(Reflect.get(candidate, 'name')).trim(),
    };
  });
}

function parseDiscoverableGroups(value: unknown): DiscoverableGroup[] {
  if (!Array.isArray(value) || value.length > MAX_DISCOVERABLE_GROUPS) {
    throw new Error('Invalid groups response');
  }

  const seenIds = new Set<string>();
  return value.map((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new Error('Invalid groups response');
    }

    const idValue = Reflect.get(candidate, 'id');
    const nameValue = Reflect.get(candidate, 'name');
    const ownerIdValue = Reflect.get(candidate, 'owner_id');
    const maxMembersValue = Reflect.get(candidate, 'max_members');
    const memberCountValue = Reflect.get(candidate, 'member_count');
    const isMemberValue = Reflect.get(candidate, 'is_member');
    const interestIdValue = Reflect.get(candidate, 'interest_id');
    const createdAtValue = Reflect.get(candidate, 'created_at');

    if (
      !isBoundedString(idValue, MAX_IDENTIFIER_LENGTH) ||
      !isBoundedString(nameValue, MAX_GROUP_NAME_LENGTH) ||
      !isBoundedString(ownerIdValue, MAX_IDENTIFIER_LENGTH) ||
      typeof maxMembersValue !== 'number' ||
      !Number.isInteger(maxMembersValue) ||
      maxMembersValue < 2 ||
      maxMembersValue > 19 ||
      typeof memberCountValue !== 'number' ||
      !Number.isInteger(memberCountValue) ||
      memberCountValue < 0 ||
      memberCountValue > maxMembersValue ||
      typeof isMemberValue !== 'boolean' ||
      (interestIdValue !== null &&
        interestIdValue !== undefined &&
        !isBoundedString(interestIdValue, MAX_IDENTIFIER_LENGTH)) ||
      typeof createdAtValue !== 'string' ||
      !Number.isFinite(Date.parse(createdAtValue))
    ) {
      throw new Error('Invalid groups response');
    }

    const id = String(idValue);
    if (seenIds.has(id)) {
      throw new Error('Duplicate groups response');
    }
    seenIds.add(id);

    return {
      id,
      name: String(nameValue).trim(),
      owner_id: String(ownerIdValue),
      max_members: maxMembersValue,
      member_count: memberCountValue,
      is_member: isMemberValue,
      interest_id:
        interestIdValue === null || interestIdValue === undefined
          ? null
          : String(interestIdValue),
      created_at: createdAtValue,
    };
  });
}

function isJoinResult(value: unknown): value is { success: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'success') === 'boolean'
  );
}

@Component({
  selector: 'app-groups-discovery',
  imports: [HlmButton, CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="flex flex-col h-full">
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
          @for (topic of interestPills(); track topic.id) {
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

      @if (error()) {
        <div
          class="bg-danger/10 text-danger px-3 py-2 mx-4 mt-3 rounded-lg text-sm shrink-0"
          role="alert"
        >
          <p>{{ error() }}</p>
          <button
            hlmBtn
            type="button"
            class="mt-2 min-h-11"
            (click)="retryDiscovery()"
            [disabled]="loading()"
          >
            {{ 'common.retry' | t }}
          </button>
        </div>
      }

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center text-text-secondary" aria-busy="true">
          {{ 'loading' | t }}
        </div>
      }

      @if (!loading() && !error() && filteredGroups().length === 0) {
        <div
          class="flex-1 flex flex-col items-center justify-center text-text-secondary py-12 px-4"
        >
          <span class="text-4xl mb-3" aria-hidden="true">👥</span>
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

      @if (!loading() && !error() && filteredGroups().length > 0) {
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (group of filteredGroups(); track group.id) {
              <div
                class="bg-surface-400 p-3 sm:p-4 rounded-xl border border-surface-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-accent-500/30"
              >
                <div class="min-w-0">
                  <span
                    class="text-text-primary font-semibold text-sm sm:text-base block truncate"
                    dir="auto"
                  >
                    {{ group.name }}
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
                      [disabled]="joiningId() !== null"
                      [attr.aria-busy]="joiningId() === group.id"
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
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly apiUrl = environment.apiUrl;

  readonly isEmbedded = input(false);

  protected readonly selectedInterest = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly joiningId = signal<string | null>(null);

  protected readonly interestsResource = resource({
    loader: async (): Promise<InterestTopic[]> => {
      try {
        const lang = this.i18n.currentLang();
        const response = await firstValueFrom(
          this.http.get<unknown>(
            `${this.apiUrl}/interests?language=${encodeURIComponent(lang)}`,
          ),
        );
        return parseInterestTopics(response);
      } catch {
        return [];
      }
    },
  });

  protected readonly interestPills = computed(
    () => this.interestsResource.value() ?? [],
  );

  protected readonly groupsResource = resource({
    loader: async (): Promise<DiscoverableGroup[]> => {
      this.error.set('');
      try {
        const response = await firstValueFrom(
          this.http.get<unknown>(`${this.apiUrl}/groups/discoverable`),
        );
        return parseDiscoverableGroups(response);
      } catch {
        this.error.set(this.i18n.translate('common.error_generic'));
        return [];
      }
    },
  });

  protected readonly loading = this.groupsResource.isLoading;
  protected readonly items = this.groupsResource.value;

  protected readonly filteredGroups = computed(() => {
    const groups = this.items();
    const interestId = this.selectedInterest();
    if (!groups) return [];
    if (!interestId) return groups;
    return groups.filter((group) => group.interest_id === interestId);
  });

  protected retryDiscovery(): void {
    this.error.set('');
    this.groupsResource.reload();
  }

  async joinGroup(groupId: string): Promise<void> {
    if (this.joiningId() !== null) return;

    const group = this.items()?.find((candidate) => candidate.id === groupId);
    if (!group || group.is_member || group.member_count >= group.max_members) {
      return;
    }

    this.error.set('');
    this.joiningId.set(groupId);
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(
          `${this.apiUrl}/groups/${encodeURIComponent(groupId)}/join`,
          {},
        ),
      );
      if (!isJoinResult(response)) {
        throw new Error('Invalid join response');
      }
      this.groupsResource.reload();
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    } finally {
      this.joiningId.set(null);
    }
  }
}
