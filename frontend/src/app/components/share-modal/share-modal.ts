import { Component, inject, input, output, signal, computed } from '@angular/core';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

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
  imports: [HlmInput, ...HlmButtonImports, ...HlmDialogImports, TranslatePipe],
  templateUrl: './share-modal.html',
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

  readonly dialogState = computed<HlmDialogState>(() =>
    this.isOpen() ? 'open' : 'closed',
  );

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.isOpen()) {
      this.closed.emit();
    }
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.isCopying.set(true);
    } catch (err: unknown) {
      console.error('Failed to copy', err);
    }
  }

  shareToFeed(): void {
    this.closed.emit();
  }

  shareToDirectMessage(): void {
    this.sharedToChat.emit('dm');
    this.closed.emit();
  }
}
