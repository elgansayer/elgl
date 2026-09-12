import { Component, computed, inject, input, output, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface StarterPanelResult {
  eligible: boolean;
  suggestions: string[];
}

const MAX_STARTERS = 3;
const MAX_STARTER_LENGTH = 160;

@Component({
  selector: 'app-conversation-starter-panel',
  imports: [HlmButton, TranslatePipe],
  template: `
    @if (starterResource.isLoading() && canShow()) {
      <section
        class="rounded-card border border-surface-100 bg-surface-100 px-4 py-3 shadow-card"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <h2 class="text-sm font-bold text-text-primary">
          {{ 'readingEngine.conversationStarters' | t }}
        </h2>
        <p class="mt-1 text-sm text-text-secondary">{{ 'common.loading' | t }}</p>
      </section>
    } @else if (starterResource.error() && canShow()) {
      <section
        class="rounded-card border border-danger/30 bg-surface-100 px-4 py-3 shadow-card"
        role="alert"
      >
        <h2 class="text-sm font-bold text-text-primary">
          {{ 'readingEngine.conversationStarters' | t }}
        </h2>
        <p class="mt-1 text-sm text-text-secondary">{{ 'common.error_generic' | t }}</p>
        <button hlmBtn type="button" size="touch" class="mt-3" (click)="retry()">
          {{ 'diagnosticQuiz.retry' | t }}
        </button>
      </section>
    } @else if (starterResource.value(); as result) {
      @if (result.eligible && canShow()) {
        <section
          class="rounded-card border border-surface-100 bg-surface-100 px-4 py-3 shadow-card"
          [attr.aria-label]="'readingEngine.conversationStarters' | t"
        >
          <h2 class="text-sm font-bold text-text-primary">
            {{ 'readingEngine.conversationStarters' | t }}
          </h2>
          @if (result.suggestions.length > 0) {
            <div class="mt-3 flex flex-col gap-2" role="list">
              @for (suggestion of result.suggestions; track suggestion) {
                <div role="listitem">
                  <button
                    hlmBtn
                    type="button"
                    variant="outline"
                    size="touch"
                    class="h-auto min-h-11 w-full justify-start whitespace-normal text-start"
                    dir="auto"
                    (click)="selectSuggestion(suggestion)"
                  >
                    {{ suggestion }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <p class="mt-1 text-sm text-text-secondary" role="status">
              {{ 'chatList.noMessages' | t }}
            </p>
          }
        </section>
      }
    }
  `,
})
export class ConversationStarterPanelComponent {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);

  readonly roomId = input.required<string>();
  readonly chatLoading = input(true);
  readonly messageCount = input(0);
  readonly composerText = input('');
  readonly suggestionSelected = output<string>();

  readonly canShow = computed(
    () =>
      !this.chatLoading() &&
      this.messageCount() === 0 &&
      this.composerText().trim().length === 0 &&
      this.roomId().trim().length > 0,
  );

  readonly starterResource = resource({
    params: () => (this.canShow() ? this.roomId() : undefined),
    loader: ({ params }) => this.loadStarters(params),
  });

  retry(): void {
    if (this.canShow()) this.starterResource.reload();
  }

  selectSuggestion(suggestion: string): void {
    if (!this.canShow()) return;
    const cleaned = suggestion.replace(/\s+/gu, ' ').trim().slice(0, MAX_STARTER_LENGTH);
    if (cleaned) this.suggestionSelected.emit(cleaned);
  }

  private async loadStarters(roomId: string): Promise<StarterPanelResult> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return { eligible: false, suggestions: [] };

    const members = await this.chatService.getRoomMembers(roomId);
    const memberIds = [...new Set(members.map((member) => member.user_id))];
    if (memberIds.length !== 2 || !memberIds.includes(currentUserId)) {
      return { eligible: false, suggestions: [] };
    }

    const partnerId = memberIds.find((memberId) => memberId !== currentUserId);
    if (!partnerId) return { eligible: false, suggestions: [] };

    const response: unknown = await this.chatService.getConversationStarters(partnerId);
    return {
      eligible: true,
      suggestions: this.normaliseSuggestions(response),
    };
  }

  private normaliseSuggestions(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const unique = new Set<string>();
    for (const candidate of value) {
      if (typeof candidate !== 'string') continue;
      const cleaned = candidate.replace(/\s+/gu, ' ').trim().slice(0, MAX_STARTER_LENGTH);
      if (cleaned.length < 4) continue;
      unique.add(cleaned);
      if (unique.size === MAX_STARTERS) break;
    }
    return [...unique];
  }
}
