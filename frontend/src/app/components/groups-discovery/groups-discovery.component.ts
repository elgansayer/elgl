import {Component, signal} from '@angular/core';import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
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
  standalone: true,
  imports: [CommonModule, TranslatePipe],
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
          @for (group of groups(); track group.id) {
            <div class="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
              <div>
                <span class="text-white font-semibold">{{ group.name }}</span>
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
  private apiUrl = environment.apiUrl;
  protected groups = signal<DiscoverableGroup[]>([]);
  protected loading = signal(true);
  protected error = signal('');
  protected joiningId = signal<string | null>(null);

  constructor() {
    this.fetchGroups();
  }

  async fetchGroups(): Promise<void> {
    try {
      const data = await fetch(`${this.apiUrl}/groups/discoverable`).then(
        (r) => r.json(),
      );
      this.groups.set(data);
    } catch {
      this.error.set('Failed to load groups');
    } finally {
      this.loading.set(false);
    }
  }

  async joinGroup(groupId: string): Promise<void> {
    this.joiningId.set(groupId);
    try {
      const res = await fetch(`${this.apiUrl}/groups/${groupId}/join`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to join');
      }
      await this.fetchGroups();
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      this.joiningId.set(null);
    }
  }
}
