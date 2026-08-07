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
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'groups_discovery_title' | t }}</h1>
      @if (error()) {
        <div class="text-red-400 mb-3">{{ error() }}</div>
      }
      @if (loading()) {
        <div class="text-slate-400">{{ 'loading' | t }}</div>
      } @else {
        <div class="space-y-3">
          @for (group of items(); track group.id) {
            <div class="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
              <div>
                <span class="text-white font-semibold">{{ group.name | sanitiseHtml }}</span>
                <span class="text-slate-400 text-sm ms-2">
                  {{ group.member_count }} / {{ group.max_members }} members
                </span>
              </div>
              @if (!group.is_member && group.member_count < group.max_members) {
                <button
                  (click)="joinGroup(group.id)"
                  class="bg-teal-500 hover:bg-teal-400 text-white px-3 py-1 rounded"
                  [disabled]="joiningId() === group.id"
                >
                  {{ 'join' | t }}
                </button>
              } @else if (group.is_member) {
                <span class="text-teal-400 text-sm">{{ 'joined' | t }}</span>
              } @else {
                <span class="text-slate-500 text-sm">{{ 'full' | t }}</span>
              }
            </div>
          }
          @empty {
            <div class="text-slate-400">{{ 'no_groups' | t }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background-color: #121212;
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
