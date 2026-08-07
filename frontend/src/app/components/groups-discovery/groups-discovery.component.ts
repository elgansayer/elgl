import { Component, inject, signal, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
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

@Component({
  selector: 'app-groups-discovery',
  imports: [CommonModule, TranslatePipe, SanitiseHtmlPipe],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <h1 class="text-xl sm:text-2xl font-bold mb-4 text-text-primary">
        {{ 'groups_discovery_title' | t }}
      </h1>
      @if (error()) {
        <div
          class="bg-red-500/10 text-red-400 px-3 py-2 rounded-lg mb-3 text-sm"
          role="alert"
        >
          {{ error() }}
        </div>
      }
      @if (loading()) {
        <div class="text-text-secondary" aria-busy="true">
          {{ 'loading' | t }}
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          @for (group of items(); track group.id) {
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
                    (click)="joinGroup(group.id)"
                    class="bg-accent-500 hover:bg-accent-400 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                    [disabled]="joiningId() === group.id"
                  >
                    {{ joiningId() === group.id ? ('loading' | t) : ('groups_discovery_join' | t) }}
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
          @empty {
            <div class="col-span-full text-text-secondary py-8 text-center">
              {{ 'groups_discovery_empty' | t }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background-color: var(--color-surface-500, #121212);
        min-height: 100vh;
      }
    `,
  ],
})
export class GroupsDiscoveryComponent {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  protected error = signal('');
  protected joiningId = signal<string | null>(null);

  protected groupsResource = resource({
    loader: async (): Promise<DiscoverableGroup[]> => {
      this.error.set('');
      try {
        return await firstValueFrom(
          this.http.get<DiscoverableGroup[]>(`${this.apiUrl}/groups/discoverable`)
        );
      } catch {
        this.error.set('Failed to load groups');
        return [];
      }
    },
  });

  protected readonly loading = this.groupsResource.isLoading;
  protected readonly items = this.groupsResource.value;

  async joinGroup(groupId: string): Promise<void> {
    this.joiningId.set(groupId);
    try {
      await firstValueFrom(
        this.http.post<unknown>(`${this.apiUrl}/groups/${groupId}/join`, {})
      );
      this.groupsResource.reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to join';
      this.error.set(message);
    } finally {
      this.joiningId.set(null);
    }
  }
}
