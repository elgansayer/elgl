import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, input, effect } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { DiscoveryService } from '../../services/discovery.service';
import { ProfileChatActionsService } from '../../services/profile-chat-actions.service';
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
  private profileChatActions = inject(ProfileChatActionsService);
  private readonly i18n = inject(I18nService);
  private translationContextKey = '';

  userId = input.required<string>();

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  readonly isFollowing = signal<boolean>(false);
  readonly isLiked = signal<boolean>(false);
  readonly isUpdatingFollow = signal<boolean>(false);
  readonly isOpeningChat = signal<boolean>(false);
  readonly actionErrorKey = signal<string>('');

  readonly translatedBioText = signal<string>('');
  readonly showTranslated = signal<boolean>(false);
  readonly isTranslating = signal<boolean>(false);
  readonly translationErrorKey = signal<string>('');

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
      this.actionErrorKey.set('');
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
      if (data) {
        this.profile.set(data);
        this.isFollowing.set(data.is_followed_by_me || false);
        this.isLiked.set(data.is_liked_by_me || false);
      } else {
        this.profile.set(null);
        this.errorMessage.set(this.i18n.translate('userProfile.notFound'));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.profile.set(null);
      this.errorMessage.set(message || this.i18n.translate('userProfile.loadError'));
    } finally {
      this.isLoading.set(false);
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
    if (!p || this.isUpdatingFollow()) return;

    const currentlyFollowing = this.isFollowing();
    this.actionErrorKey.set('');
    this.isUpdatingFollow.set(true);

    try {
      if (currentlyFollowing) {
        await this.userService.unfollowUser(p.id);
      } else {
        await this.userService.followUser(p.id);
      }
      this.isFollowing.set(!currentlyFollowing);
    } catch {
      this.actionErrorKey.set('common.error_generic');
    } finally {
      this.isUpdatingFollow.set(false);
    }
  }

  async openChat(): Promise<void> {
    const p = this.profile();
    if (!p || this.isOpeningChat()) return;

    this.actionErrorKey.set('');
    this.isOpeningChat.set(true);
    try {
      const { room_id: roomId } = await this.profileChatActions.openDirectChat(p.id);
      const navigated = await this.router.navigate(['/chat', roomId]);
      if (!navigated) this.actionErrorKey.set('common.error_generic');
    } catch {
      this.actionErrorKey.set('common.error_generic');
    } finally {
      this.isOpeningChat.set(false);
    }
  }

  async toggleLike(): Promise<void> {
    const p = this.profile();
    if (!p) return;

    const currentlyLiked = this.isLiked();
    this.isLiked.set(!currentlyLiked);

    try {
      if (!currentlyLiked) {
        await this.userService.likeProfile(p.id);
      } else {
        // The current API has no unlike mutation yet. Keep the existing behavior
        // until the backend exposes an authoritative inverse operation.
      }
    } catch {
      this.isLiked.set(currentlyLiked);
      this.actionErrorKey.set('common.error_generic');
    }
  }

  playAudioIntro(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    void audio.play().catch(() => {
      this.actionErrorKey.set('common.error_generic');
    });
  }

  private getTranslationContext(): string {
    const targetLang = this.i18n.currentLang() || 'en-GB';
    const profile = this.profile();
    return `${this.userId()}\u0000${profile?.id ?? ''}\u0000${targetLang}\u0000${profile?.bio_text ?? ''}`;
  }
}
