import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface MessageTypeFilter {
  value: 'all' | ChatMessage['message_type'];
  labelKey: string;
}

@Component({
  selector: 'app-chat-search',
  imports: [CommonModule, FormsModule, TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <div
      class="max-h-96 w-full min-w-0 overflow-hidden rounded-xl border border-surface-100 bg-surface-200 shadow-2xl sm:w-80"
      [attr.aria-busy]="isSearching()"
    >
      <div class="border-b border-surface-100 p-3">
        <label for="chat-message-search" class="mb-1.5 block text-xs font-medium text-text-muted">
          {{ 'chatRoom.searchPlaceholder' | t }}
        </label>
        <div class="relative">
          <input
            hlmInput
            id="chat-message-search"
            type="search"
            [(ngModel)]="query"
            (input)="onSearch()"
            autocomplete="off"
            class="ps-9"
          />
          <span class="absolute start-3 top-2.5 text-sm text-text-muted" aria-hidden="true">🔍</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-1 border-b border-surface-100 p-2" role="radiogroup">
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="sm"
          class="rounded-full whitespace-nowrap"
          role="radio"
          [attr.aria-checked]="searchMode() === 'within'"
          [class.bg-primary]="searchMode() === 'within'"
          [class.text-on-fill]="searchMode() === 'within'"
          (click)="setSearchMode('within')"
        >
          {{ 'chatSearch.thisChat' | t }}
        </button>
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="sm"
          class="rounded-full whitespace-nowrap"
          role="radio"
          [attr.aria-checked]="searchMode() === 'global'"
          [class.bg-primary]="searchMode() === 'global'"
          [class.text-on-fill]="searchMode() === 'global'"
          (click)="setSearchMode('global')"
        >
          {{ 'chatSearch.allChats' | t }}
        </button>
      </div>

      <div class="flex gap-1 overflow-x-auto border-b border-surface-100 p-2" role="radiogroup">
        @for (type of messageTypes; track type.value) {
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="sm"
            class="rounded-full whitespace-nowrap"
            role="radio"
            [attr.aria-checked]="selectedType() === type.value"
            [class.bg-primary]="selectedType() === type.value"
            [class.text-on-fill]="selectedType() === type.value"
            (click)="setSelectedType(type.value)"
          >
            {{ type.labelKey | t }}
          </button>
        }
      </div>

      <div class="max-h-64 overflow-y-auto" aria-live="polite">
        @if (isSearching()) {
          <div class="p-4 text-center text-sm text-text-muted" role="status">
            {{ 'chatSearch.searching' | t }}
          </div>
        }
        @if (!isSearching() && searchError()) {
          <div class="space-y-2 p-4 text-center" role="alert">
            <p class="text-sm text-danger-ink">{{ 'chatSearch.unavailable' | t }}</p>
            <button hlmBtn type="button" variant="outline" size="touch" (click)="retrySearch()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        }
        @if (
          !isSearching() &&
          !searchError() &&
          results().length === 0 &&
          query().trim().length >= minimumQueryLength
        ) {
          <div class="p-4 text-center text-sm text-text-muted" role="status">
            {{ 'chatSearch.noResults' | t }}
          </div>
        }
        @if (!searchError() && results().length > 0) {
          <ul class="m-0 list-none p-0" role="list">
            @for (msg of results(); track msg.id) {
              <li>
                <button
                  hlmBtn
                  type="button"
                  variant="ghost"
                  size="touch"
                  class="h-auto w-full justify-start rounded-none border-b border-surface-100 px-3 py-2 text-start last:border-b-0"
                  (click)="selectMessage(msg)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-2">
                      @if (searchMode() === 'global') {
                        <span
                          class="max-w-[120px] truncate rounded bg-surface-100 px-1.5 py-0.5 text-xs text-text-muted"
                        >
                          #{{ msg.room_id.slice(0, 8) }}
                        </span>
                      }
                      <span class="flex-1 truncate text-sm font-bold text-text-primary">
                        {{ msg.sender?.display_name || ('common.unknownSender' | t) }}
                      </span>
                    </span>
                    <span class="mt-1 block truncate text-sm text-text-secondary" dir="auto">
                      {{ msg.text_content || msg.message_type }}
                    </span>
                    <span class="mt-1 block text-[10px] text-text-muted">
                      {{ msg.created_at | date: 'short' }}
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
    `,
  ],
})
export class ChatSearchComponent implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);

  readonly roomId = input<string>('');
  readonly messageSelect = output<ChatMessage>();

  readonly query = signal('');
  readonly searchMode = signal<'within' | 'global'>('within');
  readonly selectedType = signal<MessageTypeFilter['value']>('all');
  readonly results = signal<ChatMessage[]>([]);
  readonly isSearching = signal(false);
  readonly searchError = signal(false);
  readonly minimumQueryLength = 2;

  readonly messageTypes: readonly MessageTypeFilter[] = [
    { value: 'all', labelKey: 'chatSearch.messageType.all' },
    { value: 'text', labelKey: 'chatSearch.messageType.text' },
    { value: 'voice', labelKey: 'chatSearch.messageType.voice' },
    { value: 'correction', labelKey: 'chatSearch.messageType.correction' },
    { value: 'doodle', labelKey: 'chatSearch.messageType.doodle' },
    { value: 'gift', labelKey: 'chatSearch.messageType.gift' },
  ];

  private readonly allResults = signal<ChatMessage[]>([]);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private requestSequence = 0;

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    this.requestSequence += 1;
  }

  onSearch(): void {
    this.scheduleSearch(300);
  }

  retrySearch(): void {
    this.scheduleSearch(0);
  }

  setSearchMode(mode: 'within' | 'global'): void {
    if (this.searchMode() === mode) return;
    this.searchMode.set(mode);
    this.scheduleSearch(0);
  }

  setSelectedType(type: MessageTypeFilter['value']): void {
    if (!this.messageTypes.some((messageType) => messageType.value === type)) return;
    this.selectedType.set(type);
    this.applyTypeFilter();
  }

  selectMessage(message: ChatMessage): void {
    this.messageSelect.emit(message);
    if (this.searchMode() === 'global' && message.room_id) {
      void this.router.navigate(['/chat', message.room_id]);
    }
  }

  private scheduleSearch(delayMs: number): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    const trimmedQuery = this.query().trim();
    if (trimmedQuery.length < this.minimumQueryLength) {
      this.requestSequence += 1;
      this.searchTimeout = null;
      this.isSearching.set(false);
      this.searchError.set(false);
      this.allResults.set([]);
      this.results.set([]);
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.searchTimeout = null;
      void this.executeSearch();
    }, delayMs);
  }

  private async executeSearch(): Promise<void> {
    const term = this.query().trim();
    if (term.length < this.minimumQueryLength) return;

    const requestId = ++this.requestSequence;
    const mode = this.searchMode();
    const room = mode === 'within' && this.roomId() ? this.roomId() : undefined;

    this.isSearching.set(true);
    this.searchError.set(false);

    try {
      const messages = await this.chatService.searchMessages(term, room);
      if (requestId !== this.requestSequence) return;
      this.allResults.set(messages);
      this.applyTypeFilter();
    } catch {
      if (requestId !== this.requestSequence) return;
      this.allResults.set([]);
      this.results.set([]);
      this.searchError.set(true);
    } finally {
      if (requestId === this.requestSequence) {
        this.isSearching.set(false);
      }
    }
  }

  private applyTypeFilter(): void {
    const type = this.selectedType();
    const messages = this.allResults();
    this.results.set(
      type === 'all' ? messages : messages.filter((message) => message.message_type === type),
    );
  }
}
