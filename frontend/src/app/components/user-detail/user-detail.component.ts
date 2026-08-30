import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { DiscoveryService } from '../../services/discovery.service';
import { AuthService } from '../../services/auth.service';
import { ProfileVisitsService } from '../../services/profile-visits.service';
import { DirectConversationService } from '../../services/direct-conversation.service';
import { ProfileRelationshipService } from '../../services/profile-relationship.service';
import { ReportButtonComponent } from '../report-user-modal/report-button.component';
import { AchievementsComponent } from '../../achievements/achievements.component';

@Component({
  selector: 'app-user-detail',
  imports: [
    HlmButton,
    CommonModule,
    RouterLink,
    TranslatePipe,
    ReportButtonComponent,
    AchievementsComponent,
  ],
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss'],
})
export class UserDetailComponent {
  private location = inject(Location);
  private router = inject(Router);
  private userService = inject(UserService);
  private discoveryService = inject(DiscoveryService);
  private authService = inject(AuthService);
  private profileVisitsService = inject(ProfileVisitsService);
  private directConversationService = inject(DirectConversationService);
  private relationshipService = inject(ProfileRelationshipService);
  private readonly i18n = inject(I18nService);
  private translationContextKey = '';
  private readonly visitAttempts = new Set<string>();

  userId = input.required<string>();

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  readonly isFollowing = signal<boolean>(false);
  readonly isFollowingPending = signal<boolean>(false);
  readonly followErrorKey = signal<string>('');
  readonly isLiked = signal<boolean>(false);

  readonly isOpeningChat = signal<boolean>(false);
  readonly chatErrorKey = signal<string>('');

  readonly translatedBioText = signal<string>('');
  readonly showTranslated = signal<boolean>(false);
  readonly isTranslating = signal<boolean>(false);
  readonly translationErrorKey = signal<string>('');

  readonly isOwnProfile = computed(() => this.profile()?.id === this.authService.currentUser()?.id);

  constructor() {
    effect(() => {
      const id = this.userId();
      this.loadProfile(id);
    });

    effect(() => {
      const context = this.getTranslationContext();
      if (context === this.translationContextKey) return;

      this.translationContextKey = context;
      this.translatedBioText.set('');
      this.showTranslated.set(false);
      this.isTranslating.set(false);
      this.translationErrorKey.set('');
      this.followErrorKey.set('');
      this.chatErrorKey.set('');
      this.isFollowingPending.set(false);
      this.isOpeningChat.set(false);
    });
  }

  goBack(): void {
    this.location.back();
  }

  async loadProfile(id: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const data = await this.userService.getUserProfile(id);
      if (id !== this.userId()) return;
      if (data) {
        this.profile.set(data);
        this.isFollowing.set(data.is_followed_by_me || false);
        this.isLiked.set(data.is_liked_by_me || false);
        void this.recordVisibleProfileVisit(data.id);
      } else {
        this.errorMessage.set(this.i18n.translate('userProfile.notFound'));
      }
    } catch (e: unknown) {
      if (id !== this.userId()) return;
      const message = e instanceof Error ? e.message : String(e);
      this.errorMessage.set(message || this.i18n.translate('userProfile.loadError'));
    } finally {
      if (id === this.userId()) {
        this.isLoading.set(false);
      }
    }
  }

  get displayBio(): string {
    const p = this.profile();
    if (!p?.bio_text) return '';
    if (this.showTranslated() && this.translatedBioText()) {
      return this.translatedBioText();
    }
    return p.bio_text;
  }

  get translationLabelKey(): string {
    if (this.isTranslating()) return 'profile.translatingBio';
    return this.showTranslated() ? 'profile.showOriginal' : 'profile.translateBio';
  }

  translationStatusId(): string {
    return `user-detail-bio-translation-status-${this.userId()}`;
  }

  followStatusId(): string {
    return `user-detail-follow-status-${this.userId()}`;
  }

  chatStatusId(): string {
    return `user-detail-chat-status-${this.userId()}`;
  }

  async toggleTranslation(): Promise<void> {
    const p = this.profile();
    if (!p?.bio_text) return;

    if (this.isTranslating()) return;

    if (this.showTranslated()) {
      this.showTranslated.set(false);
      return;
    }

    if (this.translatedBioText()) {
      this.showTranslated.set(true);
      return;
    }

    const context = this.getTranslationContext();
    const targetLang = this.i18n.currentLang() || 'en-GB';

    this.translationErrorKey.set('');
    this.isTranslating.set(true);
    try {
      const translated = await this.discoveryService.translateBio(p.id, targetLang);
      if (context !== this.getTranslationContext()) return;

      if (translated) {
        this.translatedBioText.set(translated);
        this.showTranslated.set(true);
      } else {
        this.translationErrorKey.set('common.error_generic');
      }
    } catch {
      if (context === this.getTranslationContext()) {
        this.translationErrorKey.set('common.error_generic');
      }
    } finally {
      if (context === this.getTranslationContext()) {
        this.isTranslating.set(false);
      }
    }
  }

  async toggleFollow(): Promise<void> {
    const p = this.profile();
    if (!p || this.isOwnProfile() || this.isFollowingPending()) return;

    const profileId = p.id;
    const currentlyFollowing = this.isFollowing();
    this.followErrorKey.set('');
    this.isFollowingPending.set(true);
    this.isFollowing.set(!currentlyFollowing);

    try {
      if (currentlyFollowing) {
        await this.relationshipService.unfollow(p.id);
      } else {
        await this.relationshipService.follow(p.id);
      }
    } catch {
      if (this.profile()?.id === profileId) {
        this.isFollowing.set(currentlyFollowing);
        this.followErrorKey.set('common.error_generic');
      }
    } finally {
      if (this.profile()?.id === profileId) {
        this.isFollowingPending.set(false);
      }
    }
  }

  async openConversation(): Promise<void> {
    const p = this.profile();
    if (!p || this.isOwnProfile() || this.isOpeningChat()) return;

    const profileId = p.id;
    this.chatErrorKey.set('');
    this.isOpeningChat.set(true);
    try {
      const roomId = await this.directConversationService.openOrCreate(profileId);
      if (this.profile()?.id !== profileId) return;
      const navigated = await this.router.navigate(['/chat', roomId]);
      if (!navigated) {
        throw new Error('Unable to navigate to conversation');
      }
    } catch {
      if (this.profile()?.id === profileId) {
        this.chatErrorKey.set('common.error_generic');
      }
    } finally {
      if (this.profile()?.id === profileId) {
        this.isOpeningChat.set(false);
      }
    }
  }

  async toggleLike(): Promise<void> {
    const p = this.profile();
    if (!p || this.isOwnProfile()) return;

    const currentlyLiked = this.isLiked();
    this.isLiked.set(!currentlyLiked);

    try {
      if (!currentlyLiked) {
        await this.userService.likeProfile(p.id);
      } else {
        // Assume unlike works similarly or do nothing for now
      }
    } catch (e) {
      this.isLiked.set(currentlyLiked);
      console.error('Like error:', e);
    }
  }

  playAudioIntro(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    audio.play();
  }

  private async recordVisibleProfileVisit(profileId: string): Promise<void> {
    if (this.authService.currentUser()?.id === profileId || this.visitAttempts.has(profileId)) {
      return;
    }

    this.visitAttempts.add(profileId);
    try {
      await this.profileVisitsService.recordVisit(profileId);
    } catch {
      // Profile rendering must not fail because the audit trail is temporarily unavailable.
      // Remove the attempt marker so a later successful reload can retry; the backend's
      // daily unique key makes that retry safe if the first request actually committed.
      this.visitAttempts.delete(profileId);
    }
  }

  private getTranslationContext(): string {
    const targetLang = this.i18n.currentLang() || 'en-GB';
    const profile = this.profile();
    return `${this.userId()}\u0000${profile?.id ?? ''}\u0000${targetLang}\u0000${profile?.bio_text ?? ''}`;
  }
}
