import { Component, inject, signal, input, effect } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { ReportButtonComponent } from '../report-user-modal/report-button.component';

@Component({
  selector: 'app-user-detail',
  imports: [CommonModule, RouterLink, TranslatePipe, ReportButtonComponent],
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss'],
})
export class UserDetailComponent {
  private location = inject(Location);
  private userService = inject(UserService);
  private readonly i18n = inject(I18nService);

  userId = input.required<string>();

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  readonly isFollowing = signal<boolean>(false);
  readonly isLiked = signal<boolean>(false);

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
