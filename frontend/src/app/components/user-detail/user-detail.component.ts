import { Component, inject, signal, input, effect } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { DiscoveryService } from '../../services/discovery.service';
import { ReportButtonComponent } from '../report-user-modal/report-button.component';
import { AchievementsComponent } from '../../achievements/achievements.component';

@Component({
  selector: 'app-user-detail',
  imports: [CommonModule, RouterLink, TranslatePipe, ReportButtonComponent, AchievementsComponent],
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss'],
})
export class UserDetailComponent {
  private location = inject(Location);
  private userService = inject(UserService);
  private discoveryService = inject(DiscoveryService);
  private readonly i18n = inject(I18nService);

  userId = input.required<string>();

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  readonly isFollowing = signal<boolean>(false);
  readonly isLiked = signal<boolean>(false);

  readonly translatedBioText = signal<string>('');
  readonly showTranslated = signal<boolean>(false);
  readonly isTranslating = signal<boolean>(false);

  constructor() {
    effect(() => {
      const id = this.userId();
      this.loadProfile(id);
    });
  }

  goBack(): void {
    this.location.back();
  }

  async loadProfile(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.userService.getUserProfile(id);
      if (data) {
        this.profile.set(data);
        this.isFollowing.set(data.is_followed_by_me || false);
        this.isLiked.set(data.is_liked_by_me || false);
      } else {
        this.errorMessage.set(this.i18n.translate('userProfile.notFound'));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
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

  async toggleTranslation(): Promise<void> {
    const p = this.profile();
    if (!p) return;

    if (this.isTranslating()) return;

    if (this.showTranslated()) {
      this.showTranslated.set(false);
      return;
    }

    if (this.translatedBioText()) {
      this.showTranslated.set(true);
      return;
    }

    this.isTranslating.set(true);
    try {
      const targetLang = this.i18n.currentLang() || 'en-GB';
      const translated = await this.discoveryService.translateBio(p.id, targetLang);
      if (translated) {
        this.translatedBioText.set(translated);
        this.showTranslated.set(true);
      }
    } finally {
      this.isTranslating.set(false);
    }
  }

  async toggleFollow(): Promise<void> {
    const p = this.profile();
    if (!p) return;

    const currentlyFollowing = this.isFollowing();
    this.isFollowing.set(!currentlyFollowing);

    try {
      if (currentlyFollowing) {
        await this.userService.unfollowUser(p.id);
      } else {
        await this.userService.followUser(p.id);
      }
    } catch (e) {
      this.isFollowing.set(currentlyFollowing);
      console.error('Follow error:', e);
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
}
