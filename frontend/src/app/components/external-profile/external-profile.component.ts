import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { StudyBuddiesService } from '../../services/study-buddies.service';
import { I18nService } from '../../services/i18n.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

@Component({
  selector: 'app-external-profile',
  imports: [HlmButton, CommonModule, TranslatePipe],
  template: `
    <div class="flex gap-3">
      <button
        hlmBtn
        type="button"
        (click)="sendMessage()"
        class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium"
      >
        {{ 'chat.sendMessage' | t }}
      </button>

      @if (isFollowing()) {
        <button
          hlmBtn
          type="button"
          (click)="unfollow()"
          class="flex-1 btn-secondary px-4 py-2 rounded-lg text-sm font-medium"
        >
          {{ 'profile.unfollow' | t }}
        </button>
      } @else {
        <button
          hlmBtn
          type="button"
          (click)="follow()"
          class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium"
        >
          {{ 'profile.follow' | t }}
        </button>
      }
    </div>
  `,
})
export class ExternalProfileComponent {
  readonly userId = input.required<string>();

  private readonly studyBuddiesService = inject(StudyBuddiesService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly hapticFeedback = inject(HapticFeedbackService);

  readonly isFollowing = signal(false);

  async follow(): Promise<void> {
    this.hapticFeedback.tap();
    try {
      await this.studyBuddiesService.follow(this.userId());
      this.isFollowing.set(true);
    } catch (error) {
      console.error('Follow failed:', error);
    }
  }

  async unfollow(): Promise<void> {
    this.hapticFeedback.tap();
    try {
      await this.studyBuddiesService.unfollow(this.userId());
      this.isFollowing.set(false);
    } catch (error) {
      console.error('Unfollow failed:', error);
    }
  }

  async sendMessage(): Promise<void> {
    try {
      const { channel } = await this.studyBuddiesService.getOrCreateChannel(this.userId());
      void this.router.navigate(['/chat', 'room', channel]);
    } catch (error) {
      console.error('Failed to open chat:', error);
    }
  }
}
