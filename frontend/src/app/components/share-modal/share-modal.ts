import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { Component, inject, input, output, signal, computed, resource } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { SharingService, type ShareEntityType } from '../../services/sharing';

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
  imports: [HlmInput, HlmButton, TranslatePipe, ...HlmDialogImports],
  templateUrl: './share-modal.html',
  styleUrls: ['./share-modal.scss'],
})
export class ShareModalComponent {
  readonly i18n = inject(I18nService);
  private readonly sharingService = inject(SharingService);

  // Inputs
  readonly entity = input.required<ShareEntity>();
  readonly isOpen = input<boolean>(false);

  // Outputs
  readonly closed = output<void>();
  readonly sharedToChat = output<string>(); // emits chat ID or generic indicator

  // State
  readonly isCopying = signal(false);

  private readonly backendEntityType = computed<ShareEntityType | null>(() => {
    const type = this.entity().type;
    if (type === 'profile') return 'tutor';
    if (type === 'deck') return null;
    return type;
  });

  private readonly shareLinkResource = resource({
    params: () => {
      const entityType = this.backendEntityType();
      if (!this.isOpen() || !entityType) return undefined;
      return { entityType, entityId: this.entity().id };
    },
    loader: ({ params }) =>
      params
        ? this.sharingService.createShareLink(params.entityType, params.entityId)
        : Promise.resolve(null),
  });

  readonly shareUrl = computed(
    () => this.shareLinkResource.value()?.shareUrl ?? this.entity().externalLink,
  );
  readonly dialogState = computed<HlmDialogState>(() => (this.isOpen() ? 'open' : 'closed'));

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.isOpen()) {
      this.closed.emit();
    }
  }

  close(): void {
    this.closed.emit();
  }

  async copyLink(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(this.shareUrl());
      }
      this.isCopying.set(true);
      setTimeout(() => this.isCopying.set(false), 2000);
    } catch {
      this.isCopying.set(false);
    }
  }

  shareToFeed(): void {
    // Logic to repost to Moments feed
    this.closed.emit();
  }

  shareToDirectMessage(): void {
    this.sharedToChat.emit('dm');
    this.closed.emit();
  }
}
