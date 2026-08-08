import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile } from '../../services/user.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-create-private-party',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './create-private-party.component.html',
  styles: [`
    :host { display: block; }
  `],
})
export class CreatePrivatePartyComponent {
  private readonly store = inject(AudioRoomsStore);
  private readonly discoveryService = inject(DiscoveryService);
  private readonly i18n = inject(I18nService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly MAX_INVITEES = 10;

  title = '';
  languagePair = 'en-es';
  topicTag = 'conversation';
  searchQuery = '';
  selectedInvitees = signal<UserProfile[]>([]);
  selectedInviteeIds = computed(() => this.selectedInvitees().map((m) => m.id));
  inviteeCount = computed(() => this.selectedInvitees().length);
  canAddMore = computed(() => this.inviteeCount() < this.MAX_INVITEES);
  searchResults = signal<UserProfile[]>([]);
  isSearching = signal(false);
  isCreating = signal(false);
  error = signal<string | null>(null);

  readonly languagePairOptions = [
    'en-es', 'en-fr', 'en-de', 'en-it', 'en-pt', 'en-ru',
    'en-ja', 'en-ko', 'en-zh', 'en-hi', 'en-tr', 'en-ar',
    'es-en', 'fr-en', 'de-en', 'it-en', 'pt-en',
    'ru-en', 'ja-en', 'ko-en', 'zh-en', 'ar-en',
  ];

  readonly topicOptions = [
    'conversation', 'grammar', 'pronunciation',
    'culture', 'travel', 'exam-prep', 'business',
  ];

  async searchUsers(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query || query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.isSearching.set(true);
    try {
      const results = await this.discoveryService.findPartners({
        native_languages: query,
        target_language: query,
      });
      const currentUserId = this.authService.currentUser()?.id;
      const filtered = results.filter(
        (u) =>
          u.id !== currentUserId &&
          !this.selectedInviteeIds().includes(u.id) &&
          (u.display_name?.toLowerCase().includes(query.toLowerCase()) ||
            u.native_languages?.some((l: string) => l.toLowerCase().includes(query.toLowerCase())) ||
            u.target_languages?.some((l: string) => l.toLowerCase().includes(query.toLowerCase())) ||
            u.id.toLowerCase().includes(query.toLowerCase())),
      );
      this.searchResults.set(filtered.slice(0, 20));
    } catch {
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  addInvitee(profile: UserProfile): void {
    if (!this.canAddMore()) return;
    if (this.selectedInviteeIds().includes(profile.id)) return;
    this.selectedInvitees.update((members) => [...members, profile]);
    this.searchResults.update((results) => results.filter((r) => r.id !== profile.id));
    this.searchQuery = '';
  }

  removeInvitee(profile: UserProfile): void {
    this.selectedInvitees.update((members) =>
      members.filter((m) => m.id !== profile.id),
    );
  }

  async createParty(): Promise<void> {
    if (!this.title.trim() || this.selectedInvitees().length === 0 || !this.languagePair || !this.topicTag) return;

    this.isCreating.set(true);
    this.error.set(null);

    try {
      const invitedUserIds = this.selectedInvitees().map((m) => m.id);
      await this.store.createPrivateParty(
        this.title.trim(),
        this.languagePair,
        this.topicTag,
        invitedUserIds,
      );
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : this.i18n.translate('privateParty.errorCreate');
      this.error.set(message);
    } finally {
      this.isCreating.set(false);
    }
  }
}