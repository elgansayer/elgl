import { Component, inject, computed, resource, output, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuickRepliesService, QuickReply } from '../../services/quick-replies.service';

@Component({
  selector: 'app-quick-replies',
  imports: [TranslatePipe],
  template: `
    @if (replies().length > 0) {
      <div class="flex flex-wrap gap-2 p-2">
        @for (reply of replies(); track reply.id) {
          <button
            type="button"
            class="rounded-full bg-surface-200 px-3 py-1 text-sm text-white transition-colors hover:bg-surface-300"
            (click)="onSelect(reply)"
          >
            {{ reply.key | t }}
          </button>
        }
      </div>
    }
  `,
})
export class QuickRepliesComponent {
  readonly quickRepliesInput = input<QuickReply[] | null>(null);

  private readonly quickRepliesService = inject(QuickRepliesService);
  private readonly quickRepliesResource = resource<QuickReply[], unknown>({
    loader: () => this.quickRepliesService.getQuickReplies(),
  });

  readonly replies = computed(
    () => this.quickRepliesInput() ?? this.quickRepliesResource.value() ?? [],
  );

  readonly replySelected = output<QuickReply>();

  onSelect(reply: QuickReply): void {
    this.replySelected.emit(reply);
  }
}
