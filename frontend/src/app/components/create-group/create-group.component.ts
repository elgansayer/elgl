import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { DiscoveryService } from '../../services/discovery.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-create-group',
  imports: [HlmInput, HlmButton, CommonModule, FormsModule, TranslatePipe],
  templateUrl: './create-group.component.html',
  styleUrls: ['./create-group.component.scss'],
})
export class CreateGroupComponent {
  private readonly chatService = inject(ChatService);
  private readonly discoveryService = inject(DiscoveryService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private searchRequestId = 0;

  readonly MAX_MEMBERS = 49;

  groupName = '';
  searchQuery = '';
  selectedMembers = signal<UserProfile[]>([]);
  selectedMemberIds = computed(() => this.selectedMembers().map((m) => m.id));
  selectedCount = computed(() => this.selectedMembers().length);
  canAddMore = computed(() => this.selectedCount() < this.MAX_MEMBERS);
  searchResults = signal<UserProfile[]>([]);
  isSearching = signal(false);
  isCreating = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  async searchUsers(): Promise<void> {
    const query = this.searchQuery.trim();
    const requestId = ++this.searchRequestId;

    if (!query || !this.canAddMore()) {
      this.searchResults.set([]);
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);
    try {
      const results = await this.discoveryService.findPartners({
        native_languages: query,
        target_language: query,
      });

      if (requestId !== this.searchRequestId || query !== this.searchQuery.trim()) {
        return;
      }

      const normalizedQuery = query.toLowerCase();
      const filtered = results.filter(
        (u) =>
          !this.selectedMemberIds().includes(u.id) &&
          (u.display_name?.toLowerCase().includes(normalizedQuery) ||
            u.native_languages?.some((l: string) =>
              l.toLowerCase().includes(normalizedQuery),
            ) ||
            u.target_languages?.some((l: string) =>
              l.toLowerCase().includes(normalizedQuery),
            ) ||
            u.id.toLowerCase().includes(normalizedQuery)),
      );
      this.searchResults.set(filtered.slice(0, 20));
    } catch {
      if (requestId === this.searchRequestId) {
        this.searchResults.set([]);
      }
    } finally {
      if (requestId === this.searchRequestId) {
        this.isSearching.set(false);
      }
    }
  }

  addMember(profile: UserProfile): void {
    if (!this.canAddMore()) return;
    if (this.selectedMemberIds().includes(profile.id)) return;
    this.selectedMembers.update((members) => [...members, profile]);
    this.searchRequestId += 1;
    this.isSearching.set(false);
    this.searchResults.set([]);
    this.searchQuery = '';
  }

  removeMember(profile: UserProfile): void {
    this.selectedMembers.update((members) => members.filter((m) => m.id !== profile.id));
  }

  async createGroup(): Promise<void> {
    if (
      this.isCreating() ||
      !this.groupName.trim() ||
      this.selectedMembers().length === 0
    ) {
      return;
    }

    this.isCreating.set(true);
    this.error.set(null);
    this.success.set(false);

    try {
      const memberIds = this.selectedMembers().map((m) => m.id);
      await this.chatService.createGroup(this.groupName.trim(), memberIds);
      this.success.set(true);
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : this.i18n.translate('group.errorCreate');
      this.error.set(message);
    } finally {
      this.isCreating.set(false);
    }
  }
}
