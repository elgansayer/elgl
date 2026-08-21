import { Component, inject, computed, resource, output, input } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { QuickRepliesService, QuickReply } from '../../services/quick-replies.service';

@Component({
  selector: 'app-quick-replies',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    @if (replies().length > 0) {
      <div class="flex flex-wrap gap-2 p-2">
        @for (reply of replies(); track reply.id) {
          <button hlmBtn type="button" variant="secondary" size="sm" class="rounded-full" (click)="onSelect(reply)">
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

  readonly replies = computed(() => this.quickRepliesInput() ?? this.quickRepliesResource.value() ?? []);
  readonly replySelected = output<QuickReply>();

  onSelect(reply: QuickReply): void {
    this.replySelected.emit(reply);
  }
}
