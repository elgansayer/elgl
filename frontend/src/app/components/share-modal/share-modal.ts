import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, output, signal, computed } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { A11yClickableDirective } from '../primitives/a11y-clickable';

export interface ShareEntity {
  id: string;
  type: 'profile' | 'group' | 'room' | 'moment' | 'event' | 'deck';
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  externalLink: string;
}

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [HlmInput, HlmButton, TranslatePipe, A11yClickableDirective],
  templateUrl: './share-modal.html',
  styleUrls: ['./share-modal.scss'],
})
export class ShareModalComponent {
  readonly i18n = inject(I18nService);

  // Inputs
  readonly entity = input.required<ShareEntity>();
  readonly isOpen = input<boolean>(false);

  // Outputs
  readonly closed = output<void>();
  readonly sharedToChat = output<string>(); // emits chat ID or generic indicator

  // State
  readonly isCopying = signal(false);
  readonly shareUrl = computed(() => `${this.entity().externalLink}?ref=user_token_123`);

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.isCopying.set(true);
      setTimeout(() => this.isCopying.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  shareToFeed() {
    // Logic to repost to Moments feed
    this.closed.emit();
  }

  shareToDirectMessage() {
    this.sharedToChat.emit('dm');
    this.closed.emit();
  }
}
